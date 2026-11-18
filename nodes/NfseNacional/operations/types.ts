import type { ICredentialDataDecryptedObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import type { ParsedCertificate } from '../../../core/certificate/pfxLoader';

export type Ambiente = '1' | '2' | '3';

/**
 * Dados compartilhados por todas as operações, montados uma única vez por execução
 * a partir da credencial e do certificado A1.
 */
export interface OperationContext {
	items: INodeExecutionData[];
	credentials: ICredentialDataDecryptedObject;
	certHolder: ParsedCertificate;
	certCnpj: string;
	certRazao: string;
	prestadorCnpj: string;
	codigoMunicipio: string;
	ambiente: Ambiente;
	customUrl: string;
	credRazaoSocial: string;
	credMunicipioNome: string;
	inscricaoMunicipal: string;
	credCnaePrincipal: string;
	credRegimeTributario: string;
	effectiveRegime: number;
	formatDanfseUrl: (key: string) => string | null;
}

export type OperationHandler = (
	this: IExecuteFunctions,
	itemIndex: number,
	ctx: OperationContext,
	operation: string,
) => Promise<INodeExecutionData[]>;
