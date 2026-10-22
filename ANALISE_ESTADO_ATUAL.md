# Análise do estado atual — 22/10/2026

> Registro anterior às correções. A divergência da prévia e o smoke Node foram corrigidos posteriormente. Consulte `RESULTADO_MELHORIAS.md` para o estado validado após a implementação.

## Resultado

O projeto evoluiu: recorte com contexto, recomposição nas coordenadas originais, suavização interna ajustável e harmonização de cor estão implementados. Uma nova execução real substituiu uma maçã por uma caneca apoiada na mesa, usando SDXL público, e inseriu a camada no Photopea. Neste caso, o resultado visual ficou mais convincente que o teste antigo da maçã flutuante. Isso não garante qualidade em todos os cenários.

## Verificação executada nesta análise

| Verificação | Resultado |
| --- | --- |
| `npm test` | 12 passaram |
| `npm run lint` | Passou |
| `npm run build` | Passou |
| `/tests/browser.html` | 13 verificações de canvas passaram |
| `/tests/photopea.html` | 7 verificações com Photopea real passaram |
| Botão de teste de rede no navegador | Upload, inferência, download e composição passaram |
| `/tests/live-inpaint-demo.html`, caso 1 | Maçã → caneca, camada inserida e imagem composta exportada |
| Diagnóstico de consistência da prévia | Falhou: prévia e camada diferem |
| Script de rede pelo Node | Falhou antes da API: `createImageBitmap is not defined` |

O caso real foi executado pelo harness de integração, usando os serviços atuais e a ponte real. Não equivale a repetir todos os cliques do painel React. As páginas de teste já existentes não comprovam a igualdade entre a prévia do painel e a camada final.

## Problemas confirmados

### 1. Prévia e camada final usam tratamentos diferentes

Em `src/App.tsx`, a prévia chama `compositeInpaint` sem ativar harmonização; a camada chama `inpaintLayer` com a imagem original, ativando-a. Portanto a inserção pode mudar cor e luminosidade em relação à imagem que o usuário aprovou. O PNG baixado pelo painel usa a prévia, também podendo diferir da camada.

Reprodução: abrir `/tests/review-composition.html`. Com imagem e máscara idênticas, o pixel central da prévia foi RGBA `(140,160,180,255)`, enquanto a camada composta foi `(125,145,165,255)`. A diferença ocorre no centro opaco; não é apenas arredondamento nas bordas.

Sugestão prioritária: produzir uma única camada final processada e derivar dela a prévia e a exportação. Compartilhar o processamento evita divergência futura entre duas implementações da harmonização.

### 2. Teste de rede documentado para Node está desatualizado

`scripts/smoke-free.mjs` ainda substitui métodos do fluxo antigo, incluindo `prepareSdxlMask`, que não participa mais do provedor. O fluxo novo usa `selectionBounds`, `cropScaled` e `pasteCrop`, dependentes de APIs de canvas do navegador. A execução pelo Node falha em `createImageBitmap` antes de enviar a inferência.

Sugestão: manter o teste de transporte Node diretamente sobre `runSdxlQueue` com fixtures prontas e testar canvas no navegador. Alternativamente, executar o smoke completo em navegador. Corrigir também a orientação do README.

### 3. Harmonização ainda pode alterar a cor do objeto

O ajuste é estimado na faixa de alfa parcial da máscara, mas aplicado em toda a seleção. No centro opaco, ainda recebe 60% da correção calculada. A faixa pode incluir partes do objeto original, contaminando a estimativa. Não há detecção semântica de fundo.

Sugestão: permitir desativar a harmonização, limitar o ajuste à faixa de transição e comparar em objetos coloridos e fundos texturizados antes de tratar a correção como padrão de qualidade.

### 4. Mensagens de sucesso exageram a validação visual

O harness exibe “concluído com qualidade polida” automaticamente após exportar uma imagem. Ele verifica execução, não qualidade. Entre os artefatos antigos, `case2-succulent-composite-photopea.png` apresenta uma região retangular bastante visível. A suavização não garante ausência de emendas.

Sugestão: comunicar somente a conclusão técnica e separar uma avaliação visual manual. Registrar os cenários que falham, sem generalizar a partir de um resultado bom.

## Avaliação visual e evidências

- Novo teste: `test-results/review-current-live.png` — caneca com alça, posição e contato com a mesa coerentes na visão geral. A imagem veio de inferência real desta análise.
- Reprodução da divergência: `test-results/review-preview-mismatch.png`.
- A antiga imagem `07-final-composite-photopea.png` ainda mostra uma maçã flutuando; a suavização melhora a borda, mas não corrige a composição de origem.
- O cenário novo não demonstra robustez em seleções irregulares, múltiplas regiões, fundos complexos ou transparência. Esses casos continuam necessários antes de afirmar qualidade geral.

## Próximas prioridades

1. Unificar camada, prévia e PNG baixado e adicionar teste de equivalência.
2. Restaurar o teste de transporte pelo Node ou atualizar o procedimento documentado.
3. Tornar a harmonização controlável e testar sua influência na cor do objeto.
4. Repetir casos difíceis, com inspeção a 100%, preservação de pixels externos e comparação de falhas e acertos.

Nesta análise foram adicionados apenas este relatório, uma página de reprodução e capturas de evidência. O código de produção não foi alterado.
