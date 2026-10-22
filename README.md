# AI Studio para Photopea

Edição por seleção com IA dentro do Photopea. Capture uma região, descreva a mudança e insira o resultado em uma nova camada, mantendo a imagem original disponível.

**Status: experimental.** O fluxo principal funciona, mas remoção de objetos e troca de cor ainda falharam em testes visuais. Não é uma promessa de edição perfeita ou de GPU gratuita ilimitada.

![Comparação real: câmera substituída por planta](docs/media/demo.gif)

*Comparação animada de dois PNGs reais. Não é uma gravação do editor nem representa o tempo de inferência.*

## O que funciona

- Captura da imagem e da seleção pelo painel integrado ao Photopea.
- Recorte com contexto para aproveitar a resolução do modelo.
- Recomposição no tamanho original, com transparência fora da seleção.
- Suavização interna e ajuste opcional de cor nas bordas.
- Ajustes de acabamento após gerar, sem consumir outra chamada de IA.
- Prévia e PNG derivados da mesma camada inserida no editor.
- Proteções contra inserção em outro documento ou após redimensionamento.
- Fila, progresso, cancelamento local e mensagens de erro de cota.

O caminho principal usa o Space público **SDXL Inpainting no Hugging Face**. O acesso pode ser anônimo ou com token da sua conta e está sujeito à fila, disponibilidade e cotas do serviço.

## Exemplos e limitações

| Antes | Depois |
| --- | --- |
| ![Câmera original](public/case2-camera.png) | ![Planta gerada no lugar da câmera](docs/media/plant-after.png) |

As imagens são fixtures criadas com IA, não fotografias pessoais. O exemplo acima exigiu seleção com margem suficiente para incluir a lente e as sombras.

Veja a [galeria de resultados e falhas](docs/GALERIA.md) e a [auditoria de prontidão](AUDITORIA_PRONTIDAO.md).

- Em um teste de **remoção**, o modelo criou um vaso onde deveria haver uma mesa vazia.
- Em um teste de **troca de cor**, a maçã continuou predominantemente vermelha.
- A seleção irregular em documento vertical funcionou no exemplo avaliado.
- A cota gratuita impediu a conclusão de outros dois cenários da última auditoria.

A edição é generativa: revise o resultado antes de inserir. Captura, transporte e preservação de pixels funcionando não garantem que a IA atenda ao pedido.

## Executar localmente

Requer Node.js 22.18+ e npm. Os testes usam suporte nativo a TypeScript do Node.

```sh
npm ci
npm run dev
```

Abra a URL exibida pelo Vite e clique em **Abrir no Photopea**. No editor, clique no ícone **AI Studio** na lateral direita para abrir o painel. A página isolada em localhost não tem acesso ao canvas.

1. Abra uma imagem no Photopea.
2. Selecione o objeto inteiro, suas sombras e uma margem de contexto com Laço ou Seleção retangular.
3. No painel, escolha **SDXL público** e clique em **Capturar Seleção do Canvas**.
4. Descreva o resultado desejado, preferencialmente em inglês. O prompt não é traduzido nem substituído.
5. Clique em **Aplicar Generative Fill** e confira a prévia.
6. Ajuste a suavização e a correção de cor, se necessário, e insira como nova camada.

Capture novamente depois de mudar a seleção ou redimensionar o documento. O recorte é processado em aproximadamente 1 megapixel; voltar ao tamanho original não recupera detalhes ausentes na saída do modelo.

O modo **Texto** usa uma máscara de canvas inteiro no mesmo serviço e está sujeito às mesmas cotas. **Variação** permanece desativada.

## Token, custo e privacidade

Não existe chave compartilhada no projeto. Um token Hugging Face opcional pode ser configurado em **Token Hugging Face → Usar nesta sessão**. Se o serviço negar inferência por cota, autenticar pode disponibilizar a cota da conta; não elimina os limites.

Por padrão, a chave fica na memória da sessão do painel. **Guardar chave neste navegador** usa localStorage com codificação Base64, sem criptografia. Código da mesma origem pode acessá-la. Se o navegador bloquear o armazenamento, o painel informa o fallback para sessão.

Imagens, seleção e prompts são enviados ao provedor escolhido. O histórico persistente do cliente Gradio fica desativado. Cancelar encerra a espera local e solicita cancelamento remoto; o servidor ainda pode continuar o trabalho. O limite de espera é de três minutos.

NVIDIA, OpenAI, Stability, Replicate e endpoints OpenAI-compatible são integrações opcionais com chave própria. Podem exigir créditos, cobrança ou permissões específicas e **não foram homologadas integralmente**. Não há migração automática do fluxo gratuito para um serviço pago. O proxy NVIDIA do Vite existe somente no desenvolvimento e não acompanha o build estático.

## Verificar o projeto

```sh
npm test
npm run lint
npm run build
```

Na auditoria de 22/10/2026 passaram **25 testes Node, 19 verificações de canvas, 7 de integração básica com Photopea e 9 de documentos**, além de lint e build. Esses números descrevem verificações técnicas, não avaliações de qualidade da IA.

Com Vite ativo:

| Página | Verificação |
| --- | --- |
| `/tests/browser.html` | Canvas, recorte, máscaras, transparência e composição |
| `/tests/photopea.html` | Captura e inserção no Photopea real |
| `/tests/readiness.html` | Cenários de inferência e isolamento de documentos |
| `/tests/storage-sandbox.html` | Interface com armazenamento bloqueado |
| `/tests/review-composition.html` | Consistência entre prévia e camada |

Teste explícito de transporte pela rede, enviando somente imagem sintética:

```sh
node --import ./tests/register-ts.mjs scripts/smoke-free.mjs
```

Ele aceita `HF_TOKEN` opcional do ambiente. Não coloque tokens no código. Testes de inferência consomem cota do serviço; `npm test` não faz chamadas reais de IA. Artefatos temporários em `test-results/` não são versionados; exemplos públicos selecionados estão em `docs/media/`.

## Build e instalação

```sh
npm run build
npm run manifest -- https://seu-dominio.example/ai-studio/
```

Publique `dist/` em uma hospedagem HTTPS. No Photopea, **Window → Plugins → Add Plugin** importa um arquivo JSON local: use o `dist/manifest.json` gerado para a URL da hospedagem. O manifesto em `public/` aponta para localhost e serve apenas ao desenvolvimento.

Criar o repositório no GitHub não publica automaticamente uma instalação do plugin. A hospedagem HTTPS final ainda precisa ser validada.

## Estrutura

```text
src/core/         Ponte de mensagens com Photopea
src/services/     Imagens, credenciais e fila Gradio
src/providers/    Provedores de IA
src/components/   Painel React
tests/            Testes automatizados e páginas de validação
docs/media/       Evidências públicas e GIF
scripts/          Manifesto, smoke de transporte e GIF
```

Para recriar o GIF com Python e Pillow: `python scripts/create-demo.py`. Python não é necessário para executar o aplicativo.

## Referências

[Plugins Photopea](https://www.photopea.com/api/plugins) · [Live Messaging](https://www.photopea.com/api/live) · [Scripts](https://www.photopea.com/learn/scripts) · [Space SDXL](https://huggingface.co/spaces/diffusers/stable-diffusion-xl-inpainting) · [Cotas ZeroGPU](https://huggingface.co/docs/hub/spaces-zerogpu)
