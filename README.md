# PD Tools

Site estático responsivo com 10 ferramentas funcionais, sem cadastro de visitantes.

## Como testar
Abra `index.html` no navegador. Para publicar, envie os arquivos `index.html`, `style.css` e `app.js` para um repositório GitHub e conecte o repositório à Vercel como projeto estático.

## Ferramentas
QR Code, contador de texto, gerador de senhas, calculadora, conversor de texto, conversor de medidas, cronômetro, temporizador, formatador JSON e Base64.

## Painel administrativo — importante
O painel permite ativar/desativar, editar e excluir ferramentas, além de ajustar a cor principal. Nesta versão, as alterações são salvas no `localStorage` do navegador em que foram feitas. Portanto, **não são compartilhadas com outros visitantes**. Para que o painel administre o site publicado para todos, é necessário conectar um banco/backend e proteger as operações administrativas. O painel atual não deve ser tratado como administração global.

## Observação
O gerador de QR Code carrega a biblioteca QRCode.js por CDN; essa ferramenta requer conexão com a internet. As demais ferramentas funcionam localmente no navegador.
