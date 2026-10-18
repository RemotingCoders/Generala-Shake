import { route } from '../../../lib/http.js';
import { getRoom } from '../../../lib/rooms.js';

// GET /api/rooms/:code
export default route('GET', ({ query }) => getRoom(query.code));
