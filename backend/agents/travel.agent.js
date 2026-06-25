import { queryGroq } from '../services/groqService.js';
import * as fileEditor from '../services/fileEditor.js';

export async function createTravelPage(destination, type = 'offers') {
    const prompt = `Generate a complete Next.js page component for ${type} in ${destination}. Include:
- Hero section with destination name and image
- List of ${type === 'offers' ? 'deals' : 'hotels'} (use placeholder data)
- Booking call to action
- SEO friendly structure
Return ONLY the React component code (TSX) with Tailwind CSS.`;
    const code = await queryGroq(prompt, 0.3);
    const filePath = `app/${destination.toLowerCase().replace(/ /g, '-')}/${type}.tsx`;
    await fileEditor.createFile(filePath, code);
    return { success: true, file: filePath };
}
