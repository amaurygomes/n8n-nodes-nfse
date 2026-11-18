import * as fs from 'fs';
import * as path from 'path';

/**
 * Logo oficial da NFS-e usado no cabeçalho do DANFSE.
 * O PNG fica ao lado deste arquivo e é copiado para dist/ pelo `n8n-node build`.
 */
const LOGO_PATH = path.join(__dirname, 'logo-nfs-e-horizontal.png');

let cache: Buffer | null | undefined;

export function loadLogoBuffer(): Buffer | null {
	if (cache !== undefined) return cache;
	try {
		cache = fs.readFileSync(LOGO_PATH);
	} catch {
		cache = null;
	}
	return cache;
}

export function loadLogoDataUri(): string {
	const buf = loadLogoBuffer();
	return buf ? `data:image/png;base64,${buf.toString('base64')}` : '';
}
