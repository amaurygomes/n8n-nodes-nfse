import type { INodeProperties } from 'n8n-workflow';

export const consultarDpsFields: INodeProperties[] = [
	{
		displayName: 'ID da DPS (42 Caracteres)',
		name: 'idDpsConsulta',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'DPS355030820000000000019100001000000000000100',
		description: 'Identificador único de 42 caracteres da DPS (Declaração de Prestação de Serviços)',
		displayOptions: {
			show: {
				operation: ['consultarDps'],
			},
		},
	},
	{
		displayName: 'Opções Adicionais',
		name: 'consultarDpsOpcoes',
		type: 'collection',
		placeholder: 'Adicionar Opção',
		default: {},
		displayOptions: { show: { operation: ['consultarDps'] } },
		options: [
			{
				displayName: 'Gerar DANFSE em HTML',
				name: 'gerarHtml',
				type: 'boolean',
				default: false,
				description: 'Se ativado, gera também o arquivo HTML do DANFSE se a nota estiver autorizada',
			},
			{
				displayName: 'Gerar DANFSE em PDF',
				name: 'gerarPdf',
				type: 'boolean',
				default: false,
				description: 'Se ativado, gera o PDF do DANFSE se a nota estiver autorizada',
			},
			{
				displayName: 'Ignorar Erros de Certificado SSL',
				name: 'rejectUnauthorized',
				type: 'boolean',
				default: false,
				description: 'Se ativado, ignora erros de validação SSL/TLS',
			},
			{
				displayName: 'Omitir Dados Sigilosos (Modo Gravação / Demo)',
				name: 'mascararDadosSigilosos',
				type: 'boolean',
				default: false,
				description: 'Se ativado, mascara e oculta dados sigilosos (CPF, CNPJ, e-mails, telefones, endereço e chave de acesso) no PDF e HTML do DANFSE gerados',
			},
			{
				displayName: 'Tempo Limite da Requisição (ms)',
				name: 'timeoutMs',
				type: 'number',
				default: 25000,
				description: 'Tempo máximo em milissegundos para aguardar a resposta da SEFIN Nacional',
			},
		],
	},
];
