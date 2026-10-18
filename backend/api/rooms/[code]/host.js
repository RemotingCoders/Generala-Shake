import { route } from '../../../lib/http.js';
import { hostAction } from '../../../lib/rooms.js';

// POST /api/rooms/:code/host
export default route('POST', ({ body, query }) => hostAction(query.code, body));
