import type { INodeProperties } from 'n8n-workflow';

export const operationField: INodeProperties = {
	displayName: 'Operação',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	options: [
		{
			name: 'Cancelar NFS-e (Evento 101101)',
			value: 'cancelar',
			description: 'Gera, assina com o Certificado A1 e transmite o pedido de cancelamento para a SEFIN Nacional',
			action: 'Cancelar NFS-e',
		},

		{
			name: 'Consultar Eventos da NFS-e',
			value: 'consultarEventos',
			description: 'Consulta o histórico de eventos vinculados (cancelamentos, substituições) de uma NFS-e',
			action: 'Consultar Eventos da NFS-e',
		},
		{
			name: 'Consultar NFS-e por Chave',
			value: 'consultar',
			description: 'Consulta o status e faz download do XML oficial da NFS-e pela chave de acesso de 50 dígitos',
			action: 'Consultar NFS-e por Chave',
		},
		{
			name: 'Consultar Processamento do DPS',
			value: 'consultarDps',
			description: 'Consulta o status de processamento de um DPS enviado à SEFIN',
			action: 'Consultar Processamento do DPS',
		},
		{
			name: 'Emitir NFS-e',
			value: 'emitir',
			description: 'Gera a DPS, assina digitalmente com o Certificado A1 e autoriza na SEFIN Nacional',
			action: 'Emitir NFS-e',
		},
		{
			name: 'Gerar DANFSE (PDF)',
			value: 'gerarDanfse',
			description: 'Gera o PDF oficial do DANFSE com QR Code a partir de uma nota autorizada ou cancelada',
			action: 'Gerar DANFSE (PDF)',
		},
		{
			name: 'Substituir NFS-e (Evento 101102)',
			value: 'substituir',
			description: 'Emite uma nova NFS-e em substituição a uma anterior, cancelando a original',
			action: 'Substituir NFS-e',
		},
	],
	default: 'emitir',
};
