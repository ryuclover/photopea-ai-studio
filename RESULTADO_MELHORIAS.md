# Resultado das melhorias — 22/10/2026

> Registro da rodada anterior. A auditoria posterior ampliou os casos e encontrou falhas em remoção e troca de cor. Consulte `AUDITORIA_PRONTIDAO.md` para o veredito atual e as novas correções.

## Avaliação

O fluxo está utilizável para edição assistida: duas substituições reais foram conferidas, a composição foi unificada e o acabamento pode ser ajustado sem nova inferência. Os resultados aprovados não apresentam o retângulo forte do teste original. O usuário ainda precisa revisar a imagem: o modelo pode desobedecer detalhes do prompt ou gerar objetos incoerentes.

## Alterações

- Prévia e PNG baixado derivam do mesmo PNG transparente inserido como camada. Removida a implementação duplicada da harmonização.
- Correção de cor opcional, limitada à transição das bordas: desaparece no interior opaco e não muda globalmente a cor do objeto.
- Suavização e correção de cor recompõem localmente a saída original da IA, sem nova chamada. Trocas rápidas invalidam composições antigas. Nova captura e limpeza descartam o resultado anterior.
- Orientação de seleção explica a necessidade de incluir objeto inteiro, sombras e margem.
- Smoke Node usa a fila e o download diretamente, sem depender de APIs de canvas. Token opcional vem de `HF_TOKEN`.
- Cenário da câmera inclui toda a lente e as sombras; prompt refinado para evitar estruturas semelhantes à câmera.
- Harness confere pixels externos e compara a prévia com o PNG exportado pelo Photopea. Mensagem de sucesso não presume qualidade visual.
- Watcher do Vite ignora relatórios e resultados gerados, evitando recargas durante os testes.

## Validação

| Verificação | Resultado |
| --- | --- |
| Testes Node | 12 passaram |
| Canvas no navegador | 19 passaram |
| Integração Photopea | 7 passaram |
| Lint e build | Passaram |
| Smoke de transporte Node | Inferência e download reais concluídos; WebP recebido |
| Câmera → planta | Inferência autenticada, inserção e exportação concluídas |
| Comparação da planta | Zero diferenças fora da seleção; diferença máxima prévia/Photopea de 1/255 |
| Maçã → caneca no painel React | Captura, inferência autenticada, ajustes locais e inserção confirmados |
| Ajustes locais | Suavização e correção de cor atualizaram a prévia sem repetir a inferência |

O cliente Gradio no smoke Node imprimiu AbortError ao fechar o stream após receber o resultado. O arquivo foi baixado e o processo terminou com código 0; a saída de diagnóstico da biblioteca ainda pode ser ruidosa.

## Inspeção visual e limites

O primeiro resultado da planta tinha um detalhe parecido com lente e não foi aprovado. A seleção ampliada e o prompt revisado produziram um vaso simples com planta, apoiado na mesa, sem lente lateral nem emenda retangular forte. O vaso saiu escuro, embora o pedido mencionasse terracota: fidelidade exata de cor continua limitada pelo modelo.

A caneca foi produzida pelo painel de produção. Suavização e harmonização atualizaram a prévia localmente. Os controles foram restaurados a 24 px e correção ativa antes de inserir. A camada original foi mantida. Alça, posição e sombra ficaram coerentes; o café escuro solicitado não ficou claramente representado.

Os exemplos ficaram bons em integração, mas não comprovam fidelidade a cada palavra ou qualidade universal. Uma seleção apertada pode revelar restos do objeto original. Pixels externos são preservados por projeto.

## Evidências

- `test-results/final-plant-improved.png`: planta aprovada visualmente, inferência real.
- `test-results/final-plant.png`: tentativa anterior com detalhe semelhante a lente, mantida para comparação.
- `test-results/final-mug-photopea.png`: caneca inserida pelo painel React, com ambas as camadas visíveis.
- `test-results/final-canvas-tests.txt` e `test-results/final-bridge-tests.txt`: resultados do navegador.

Nenhuma credencial foi adicionada ao código ou aos relatórios. O acesso gratuito continua sujeito às cotas: a anônima acabou durante os testes e as verificações seguintes usaram o token fornecido pelo usuário somente na sessão.
