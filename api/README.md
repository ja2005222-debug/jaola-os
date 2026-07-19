# Task Manager API

## Endpoints

### GET /api/tasks
- **Description**: Retrieve all tasks. Optional query parameter `status` to filter by `active` or `completed`.
- **Response**: `{ success: true, data: [task1, task2, ...] }`
- **Status Codes**: 200 OK, 500 Internal Server Error

### POST /api/tasks
- **Description**: Create a new task.
- **Request Body**: `{ "title": "string", "due_date": "YYYY-MM-DD" }`
- **Response**: `{ success: true, data: newTask }`
- **Status Codes**: 201 Created, 400 Bad Request (validation error), 500 Internal Server Error

### PUT /api/tasks/:id
- **Description**: Update an existing task. Provide `title` and/or `status`.
- **Request Body**: `{ "title": "string", "status": "active|completed" }`
- **Response**: `{ success: true, data: updatedTask }`
- **Status Codes**: 200 OK, 400 Bad Request, 404 Not Found, 500 Internal Server Error

### DELETE /api/tasks/:id
- **Description**: Delete a task.
- **Response**: `{ success: true, message: "Task deleted" }`
- **Status Codes**: 200 OK, 404 Not Found, 500 Internal Server Error

## Error Handling
All errors return a JSON object with `success: false` and a `message` string. No stack traces are exposed.