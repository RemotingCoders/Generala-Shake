import { route } from '../../../lib/http.js';
import { joinRoom } from '../../../lib/rooms.js';

// POST /api/rooms/:code/join
export default route('POST', ({ body, query }) => joinRoom(query.code, body));
