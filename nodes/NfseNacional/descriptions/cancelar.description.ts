import type { INodeProperties } from 'n8n-workflow';

export const cancelarFields: INodeProperties[] = [
	{
		displayName: 'Chave de Acesso da NFS-e (50 Dígitos)',
		name: 'chaveAcessoCancelamento',
		type: 'string',
		default: '',
		required: true,
		placeholder: '3550308000000000000191000010000000000001234567890',
		description: 'Chave de acesso de 50 dígitos da nota fiscal a ser cancelada',
		displayOptions: {
			show: {
				operation: ['cancelar'],
			},
		},
	},
	{
		displayName: 'Código do Motivo',
		name: 'codigoMotivo',
		type: 'options',
		options: [
			{
				name: '1 - Erro na Emissão',
				value: '1',
				description: 'Dados incorretos ou erro de preenchimento na emissão da nota',
			},
			{
				name: '2 - Serviço Não Prestado',
				value: '2',
				description: 'O serviço acordado não foi ou não será executado',
			},
			{
				name: '9 - Outros',
				value: '9',
				description: 'Outro motivo plausível devidamente justificado',
			},
		],
		default: '1',
		displayOptions: {
			show: {
				operation: ['cancelar'],
			},
		},
	},
	{
		displayName: 'Justificativa do Cancelamento',
		name: 'justificativaCancelamento',
		type: 'string',
		typeOptions: {
			rows: 3,
		},
		default: '',
		required: true,
		placeholder: 'Ex: Cancelamento da nota fiscal por erro no preenchimento dos dados',
		description: 'Motivo detalhado do cancelamento (a Receita Federal exige no mínimo 15 caracteres)',
		displayOptions: {
			show: {
				operation: ['cancelar'],
			},
		},
	},
	{
		displayName: 'Opções Adicionais',
		name: 'cancelarOpcoes',
		type: 'collection',
		placeholder: 'Adicionar Opção',
		default: {},
		displayOptions: { show: { operation: ['cancelar'] } },
		options: [
			{
				displayName: 'Ignorar Erros de Certificado SSL',
				name: 'rejectUnauthorized',
				type: 'boolean',
				default: false,
				description: 'Se ativado, ignora erros de validação SSL/TLS',
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
