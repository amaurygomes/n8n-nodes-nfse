import type { OperationHandler } from './types';
import { emitir } from './emitir.operation';
import { consultar } from './consultar.operation';
import { consultarDps } from './consultarDps.operation';
import { cancelar } from './cancelar.operation';
import { consultarEventos } from './consultarEventos.operation';
import { gerarDanfse } from './gerarDanfse.operation';

/** Mapa operação → handler. Para adicionar uma operação, crie o arquivo e registre aqui. */
export const operationHandlers: Record<string, OperationHandler> = {
	emitir,
	substituir: emitir,
	consultar,
	consultarDps,
	cancelar,
	consultarEventos,
	gerarDanfse,
};

export { buildOperationContext } from './context';
export type { OperationContext, OperationHandler } from './types';
