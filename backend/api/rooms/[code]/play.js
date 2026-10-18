import { route } from '../../../lib/http.js';
import { playAction } from '../../../lib/rooms.js';

// POST /api/rooms/:code/play
export default route('POST', ({ body, query }) => playAction(query.code, body));
