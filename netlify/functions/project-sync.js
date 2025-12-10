// Netlify Function: Sync projects
// POST /.netlify/functions/project-sync
// Handles bidirectional sync between device and server (no encryption)

import { neon } from '@neondatabase/serverless';

export async function handler(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

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
    const { action, userId, deviceId, projects, lastSyncTime } = JSON.parse(event.body || '{}');

    if (!userId || !deviceId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'userId and deviceId are required' })
      };
    }

    // Ensure table exists
    await sql`
      CREATE TABLE IF NOT EXISTS projects (
        id VARCHAR PRIMARY KEY,
        user_id VARCHAR NOT NULL,
        device_id VARCHAR NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        progress INTEGER DEFAULT 0,
        tasks JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        is_deleted BOOLEAN DEFAULT FALSE
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_projects_user_updated 
      ON projects(user_id, updated_at)
    `;

    if (action === 'push') {
      if (!projects || !Array.isArray(projects)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'projects array is required for push' })
        };
      }

      const results = { pushed: 0, conflicts: [] };

      for (const project of projects) {
        const existing = await sql`
          SELECT id, updated_at 
          FROM projects 
          WHERE id = ${project.id} AND user_id = ${userId}
        `;

        if (existing.length === 0) {
          // New project - insert
          await sql`
            INSERT INTO projects (id, user_id, device_id, name, description, progress, tasks, created_at, updated_at, is_deleted)
            VALUES (
              ${project.id}, 
              ${userId}, 
              ${deviceId}, 
              ${project.name}, 
              ${project.description || ''}, 
              ${project.progress || 0},
              ${JSON.stringify(project.tasks || [])},
              ${project.createdAt}::timestamp, 
              ${project.updatedAt}::timestamp, 
              ${project.isDeleted || false}
            )
          `;
          results.pushed++;
        } else {
          const serverProject = existing[0];
          const serverTime = new Date(serverProject.updated_at);
          const localTime = new Date(project.updatedAt);

          if (localTime > serverTime) {
            // Local is newer - update server
            await sql`
              UPDATE projects 
              SET name = ${project.name}, 
                  description = ${project.description || ''},
                  progress = ${project.progress || 0},
                  tasks = ${JSON.stringify(project.tasks || [])},
                  updated_at = ${project.updatedAt}::timestamp,
                  is_deleted = ${project.isDeleted || false},
                  device_id = ${deviceId}
              WHERE id = ${project.id} AND user_id = ${userId}
            `;
            results.pushed++;
          } else if (serverTime > localTime) {
            // Server is newer - conflict
            results.conflicts.push({
              id: project.id,
              serverUpdatedAt: serverProject.updated_at,
              localUpdatedAt: project.updatedAt
            });
          } else {
            // Same time - assume synced
            results.pushed++;
          }
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          ...results,
          message: `Pushed ${results.pushed} projects, ${results.conflicts.length} conflicts`
        })
      };

    } else if (action === 'pull') {
      let serverProjects;
      
      if (lastSyncTime) {
        serverProjects = await sql`
          SELECT 
            id, 
            name, 
            description, 
            progress,
            tasks,
            created_at as "createdAt", 
            updated_at as "updatedAt", 
            is_deleted as "isDeleted"
          FROM projects 
          WHERE user_id = ${userId} 
            AND updated_at > ${lastSyncTime}::timestamp
          ORDER BY updated_at DESC
        `;
      } else {
        serverProjects = await sql`
          SELECT 
            id, 
            name, 
            description, 
            progress,
            tasks,
            created_at as "createdAt", 
            updated_at as "updatedAt", 
            is_deleted as "isDeleted"
          FROM projects 
          WHERE user_id = ${userId}
          ORDER BY updated_at DESC
        `;
      }

      // Parse tasks JSON for each project
      const parsedProjects = serverProjects.map(p => ({
        ...p,
        tasks: typeof p.tasks === 'string' ? JSON.parse(p.tasks) : p.tasks
      }));

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          projects: parsedProjects,
          count: parsedProjects.length,
          syncTime: new Date().toISOString()
        })
      };

    } else if (action === 'delete') {
      const { projectId } = JSON.parse(event.body || '{}');
      
      if (!projectId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'projectId is required for delete' })
        };
      }

      await sql`
        UPDATE projects 
        SET is_deleted = TRUE, updated_at = NOW()
        WHERE id = ${projectId} AND user_id = ${userId}
      `;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: 'Project marked as deleted' })
      };

    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid action. Use: push, pull, or delete' })
      };
    }

  } catch (error) {
    console.error('Project sync error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Sync failed', details: error.message })
    };
  }
}
