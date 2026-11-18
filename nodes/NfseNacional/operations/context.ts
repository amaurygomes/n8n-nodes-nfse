import type { IExecuteFunctions } from 'n8n-workflow';
import { PfxLoader } from '../../../core/certificate/pfxLoader';
import type { Ambiente, OperationContext } from './types';

/**
 * Lê a credencial, carrega o certificado A1 e resolve os dados do prestador.
 */
export async function buildOperationContext(this: IExecuteFunctions): Promise<OperationContext> {
	const credentials = await this.getCredentials('nfseNacionalApi');
	const certSource = (credentials.certificateSource as string) || 'base64';

	const certHolder = PfxLoader.load({
		base64: certSource === 'base64' ? (credentials.certificateBase64 as string) : undefined,
		path: certSource === 'path' ? (credentials.certificatePath as string) : undefined,
		password: credentials.certificatePassword as string,
	});

	// Dados extraídos do Certificado Digital A1 (caso não informados na credencial)
	const certCnpj = certHolder.cnpjCpf || '';
	const certRazao = certHolder.commonName ? certHolder.commonName.split(':')[0].trim() : certHolder.subject;
	const credRegimeTributario = (credentials.regimeTributario as string) || '3';

	return {
		items: this.getInputData(),
		credentials,
		certHolder,
		certCnpj,
		certRazao,
		prestadorCnpj: ((credentials.prestadorCnpj as string) || certCnpj).replace(/[^0-9A-Za-z]/g, '').toUpperCase(),
		codigoMunicipio: (credentials.codigoMunicipio as string) || '',
		ambiente: (credentials.ambiente as Ambiente) || '2',
		customUrl: credentials.customUrl as string,
		credRazaoSocial: (credentials.razaoSocial as string) || certRazao,
		credMunicipioNome: (credentials.municipioNome as string) || '',
		inscricaoMunicipal: (credentials.prestadorInscricaoMunicipal as string) || '',
		credCnaePrincipal: (credentials.cnaePrincipal as string) || '',
		credRegimeTributario,
		effectiveRegime: Number(credRegimeTributario || '3'),
		formatDanfseUrl: (key: string) => (key ? `https://www.nfse.gov.br/ConsultaPublica/?tpc=1&chave=${key}` : null),
	};
}
