import {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class NfseNacionalApi implements ICredentialType {
	name = 'nfseNacionalApi';
	displayName = 'NFS-e Nacional (Certificado A1 & SEFIN)';
	documentationUrl = 'https://github.com/amaurygomes/n8n-nodes-nfse#readme';
	icon = 'file:nfseNacional.svg' as const;

	properties: INodeProperties[] = [
		{
			displayName: 'Formato do Certificado A1',
			name: 'certificateSource',
			type: 'options',
			options: [
				{
					name: 'Certificado em Base64 (Recomendado)',
					value: 'base64',
					description: 'Cole o conteúdo do arquivo .pfx/.p12 convertido em Base64',
				},
				{
					name: 'Caminho do Arquivo (.pfx no Servidor)',
					value: 'path',
					description: 'Caminho absoluto para o arquivo .pfx montado no container ou servidor',
				},
			],
			default: 'base64',
			typeOptions: { password: true },
		},
		{
			displayName: 'Certificado A1 (.pfx em Base64)',
			name: 'certificateBase64',
			type: 'string',
			typeOptions: { password: true },
			displayOptions: {
				show: {
					certificateSource: ['base64'],
				},
			},
			default: '',
			placeholder: 'MIIJyQIBAzCCCS8GCSqGSIb3DQEHAaCCCSEEggkdMIIJGTCCB...',
			description: 'Conteúdo Base64 do seu certificado digital ICP-Brasil A1',
		},
		{
			displayName: 'Caminho do Arquivo .pfx',
			name: 'certificatePath',
			type: 'string',
			displayOptions: {
				show: {
					certificateSource: ['path'],
				},
			},
			default: '',
			placeholder: '/certs/certificado.pfx',
			description: 'Caminho no sistema de arquivos para o arquivo .pfx',
			typeOptions: { password: true },
		},
		{
			displayName: 'Senha do Certificado A1',
			name: 'certificatePassword',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Senha de proteção da chave privada do certificado digital',
		},
		{
			displayName: 'CNPJ do Prestador (Emitente)',
			name: 'prestadorCnpj',
			type: 'string',
			default: '',
			required: true,
			placeholder: '00000000000199',
			description: 'CNPJ do emitente da NFS-e (14 dígitos numéricos ou alfanumérico conforme IN RFB 2.229/2024)',
		},
		{
			displayName: 'Inscrição Municipal',
			name: 'prestadorInscricaoMunicipal',
			type: 'string',
			default: '',
			placeholder: '12345678',
			description: 'Inscrição Municipal do prestador (se houver)',
		},
		{
			displayName: 'Código do Município Emissor (IBGE)',
			name: 'codigoMunicipio',
			type: 'string',
			default: '',
			required: true,
			placeholder: 'Ex: 3550308',
			description: 'Código IBGE de 7 dígitos do município emissor (ex: 3550308 para São Paulo)',
		},
		{
			displayName: 'Razão Social da Empresa',
			name: 'razaoSocial',
			type: 'string',
			default: '',
			required: true,
			placeholder: 'Ex: MINHA EMPRESA LTDA',
			description: 'Razão social da sua empresa para exibir no DANFSE.',
		},
		{
			displayName: 'Nome do Município e UF',
			name: 'municipioNome',
			type: 'string',
			default: '',
			required: true,
			placeholder: 'Ex: São Paulo - SP',
			description: 'Nome do município e UF da sua empresa para exibição no DANFSE.',
		},
		{
			displayName: 'CNAE Principal',
			name: 'cnaePrincipal',
			type: 'string',
			default: '',
			required: true,
			placeholder: '5320-2/02',
			description: 'CNAE principal de atividade da sua empresa. Usado no DANFSe.',
		},
		{
			displayName: 'E-mail da Empresa',
			name: 'prestadorEmail',
			type: 'string',
			default: '',
			placeholder: 'contato@minhaempresa.com.br',
			description: 'E-mail exibido no quadro do prestador no PDF',
		},
		{
			displayName: 'Telefone da Empresa',
			name: 'prestadorTelefone',
			type: 'string',
			default: '',
			placeholder: '(11) 99999-9999',
			description: 'Telefone exibido no quadro do prestador no PDF',
		},
		{
			displayName: 'Endereço Completo (Logradouro, Número, Bairro)',
			name: 'prestadorEndereco',
			type: 'string',
			default: '',
			placeholder: 'Rua Principal, 123 - Centro',
			description: 'Endereço exibido no quadro do prestador no PDF',
		},
		{
			displayName: 'CEP da Empresa',
			name: 'prestadorCep',
			type: 'string',
			default: '',
			placeholder: '01000-000',
			description: 'CEP exibido no quadro do prestador no PDF',
		},
		{
			displayName: 'Regime Tributário da Empresa',
			name: 'regimeTributario',
			type: 'options',
			options: [
				{
					name: '1 - Não Optante (Lucro Presumido / Real)',
					value: '1',
					description: 'Tributação Normal municipal/federal',
				},
				{
					name: '2 - Simples Nacional - MEI',
					value: '2',
					description: 'Microempreendedor Individual (Art. 18-A da LC 123/2006)',
				},
				{
					name: '3 - Simples Nacional (ME/EPP)',
					value: '3',
					description: 'Optante pelo Simples Nacional - Microempresa ou EPP (LC 123/2006)',
				},
			],
			default: '2',
			description: 'Regime tributário padrão do emitente. Define a tag opSimpNac na DPS e o aviso fiscal no DANFSe.',
		},
		{
			displayName: 'Ambiente Padrão',
			name: 'ambiente',
			type: 'options',
			options: [
				{
					name: '2 - Homologação (Produção Restrita / Testes)',
					value: '2',
				},
				{
					name: '1 - Produção (SEFIN Nacional Oficial)',
					value: '1',
				},
				{
					name: '3 - Customizado (Proxy ou Próprio Endpoint)',
					value: '3',
				},
			],
			default: '2',
			description: 'Ambiente fiscal para autorização das notas',
		},
		{
			displayName: 'URL Personalizada (Endpoint Customizado)',
			name: 'customUrl',
			type: 'string',
			displayOptions: {
				show: {
					ambiente: ['3'],
				},
			},
			default: '',
			placeholder: 'https://meu-proxy.com/sefinnacional/nfse',
			description: 'URL customizada da API para emissão e consulta da NFS-e (usado com o ambiente Customizado)',
		},
	];
}
