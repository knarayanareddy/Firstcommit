import { marked } from 'marked';
import DOMPurify from 'dompurify';

// @ts-ignore
const vscode = acquireVsCodeApi();

window.addEventListener('message', event => {
    const message = event.data;
    
    if (message.type === 'renderState') {
        const container = document.getElementById('content');
        if (!container) return;
        
        if (message.state === 'loading') {
            container.innerHTML = '<div class="loading">Analyzing selection and retrieving context...</div>';
        } else if (message.state === 'error') {
            container.innerHTML = `<div class="error"><strong>Error:</strong> ${message.error}</div>`;
        } else if (message.state === 'success') {
            // Replace RocketBoard citations like [S1] or [S1, S2] with clickable links
            let md = message.markdown || "";
            
            md = md.replace(/\[(S\d+(?:,\s*S\d+)*)\]/g, (match: string, inner: string) => {
                const badges = inner.split(',').map((b: string) => b.trim());
                const links = badges.map((b: string) => `<a href="#" class="citation-link" data-badge="${b}">[${b}]</a>`).join(' ');
                return links;
            });

            const rawHtml = marked.parse(md) as string;
            // Allow custom data attributes for the citation links
            const cleanHtml = DOMPurify.sanitize(rawHtml, { ADD_ATTR: ['data-badge'] });
            
            container.innerHTML = cleanHtml;
            
            // Attach event listeners to the generated citation links
            const links = container.querySelectorAll('.citation-link');
            links.forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const badge = (e.currentTarget as HTMLElement).getAttribute('data-badge');
                    if (badge) {
                        vscode.postMessage({ type: 'openCitation', badge });
                    }
                });
            });
        }
    }
});
