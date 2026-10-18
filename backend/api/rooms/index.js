import { route } from '../../lib/http.js';
import { createRoom } from '../../lib/rooms.js';

// POST /api/rooms
export default route('POST', ({ body, req }) => createRoom(body, req));
