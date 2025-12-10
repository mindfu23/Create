// Netlify Function: Sync journal entries
// POST /.netlify/functions/journal-sync
// Handles bidirectional sync between device and server

import { neon } from '@neondatabase/serverless';

export async function handler(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  // Check for database connection
  if (!process.env.DATABASE_URL) {
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({ 
        error: 'Database not configured',
        message: 'Set DATABASE_URL environment variable in Netlify'
      })
    };
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    const { action, userId, deviceId, entries, lastSyncTime } = JSON.parse(event.body || '{}');

    if (!userId || !deviceId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'userId and deviceId are required' })
      };
    }

    // Ensure table exists
    await sql`
      CREATE TABLE IF NOT EXISTS journal_entries (
        id VARCHAR PRIMARY KEY,
        user_id VARCHAR NOT NULL,
        device_id VARCHAR NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        checksum VARCHAR(64) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        is_deleted BOOLEAN DEFAULT FALSE
      )
    `;

    // Create index for efficient queries
    await sql`
      CREATE INDEX IF NOT EXISTS idx_journal_user_updated 
      ON journal_entries(user_id, updated_at)
    `;

    if (action === 'push') {
      // Push local entries to server
      if (!entries || !Array.isArray(entries)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'entries array is required for push' })
        };
      }

      const results = { pushed: 0, conflicts: [] };

      for (const entry of entries) {
        // Check if entry exists on server
        const existing = await sql`
          SELECT id, checksum, updated_at 
          FROM journal_entries 
          WHERE id = ${entry.id} AND user_id = ${userId}
        `;

        if (existing.length === 0) {
          // New entry - insert
          await sql`
            INSERT INTO journal_entries (id, user_id, device_id, title, content, checksum, created_at, updated_at, is_deleted)
            VALUES (${entry.id}, ${userId}, ${deviceId}, ${entry.title}, ${entry.content}, ${entry.checksum}, 
                    ${entry.createdAt}::timestamp, ${entry.updatedAt}::timestamp, ${entry.isDeleted || false})
          `;
          results.pushed++;
        } else {
          const serverEntry = existing[0];
          
          if (serverEntry.checksum === entry.checksum) {
            // Same content, just update sync time
            results.pushed++;
          } else {
            // Conflict - check timestamps
            const serverTime = new Date(serverEntry.updated_at);
            const localTime = new Date(entry.updatedAt);

            if (localTime > serverTime) {
              // Local is newer - update server
              await sql`
                UPDATE journal_entries 
                SET title = ${entry.title}, 
                    content = ${entry.content}, 
                    checksum = ${entry.checksum},
                    updated_at = ${entry.updatedAt}::timestamp,
                    is_deleted = ${entry.isDeleted || false},
                    device_id = ${deviceId}
                WHERE id = ${entry.id} AND user_id = ${userId}
              `;
              results.pushed++;
            } else {
              // Server is newer - conflict
              results.conflicts.push({
                id: entry.id,
                serverUpdatedAt: serverEntry.updated_at,
                localUpdatedAt: entry.updatedAt
              });
            }
          }
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          ...results,
          message: `Pushed ${results.pushed} entries, ${results.conflicts.length} conflicts`
        })
      };

    } else if (action === 'pull') {
      // Pull entries from server that are newer than lastSyncTime
      let serverEntries;
      
      if (lastSyncTime) {
        serverEntries = await sql`
          SELECT id, title, content, checksum, created_at as "createdAt", 
                 updated_at as "updatedAt", is_deleted as "isDeleted"
          FROM journal_entries 
          WHERE user_id = ${userId} 
            AND updated_at > ${lastSyncTime}::timestamp
          ORDER BY updated_at DESC
        `;
      } else {
        // First sync - get all entries
        serverEntries = await sql`
          SELECT id, title, content, checksum, created_at as "createdAt", 
                 updated_at as "updatedAt", is_deleted as "isDeleted"
          FROM journal_entries 
          WHERE user_id = ${userId}
          ORDER BY updated_at DESC
        `;
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          entries: serverEntries,
          count: serverEntries.length,
          syncTime: new Date().toISOString()
        })
      };

    } else if (action === 'delete') {
      // Soft delete entry
      const { entryId } = JSON.parse(event.body || '{}');
      
      if (!entryId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'entryId is required for delete' })
        };
      }

      await sql`
        UPDATE journal_entries 
        SET is_deleted = TRUE, updated_at = NOW()
        WHERE id = ${entryId} AND user_id = ${userId}
      `;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: 'Entry marked as deleted' })
      };

    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid action. Use: push, pull, or delete' })
      };
    }

  } catch (error) {
    console.error('Sync error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Sync failed', details: error.message })
    };
  }
}
