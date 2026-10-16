# Atualização editorial — Rainha dos Calçados

Esta versão reconstrói a página inicial como uma vitrine editorial, inspirada na referência aprovada:

- Cabeçalho premium e uma recepção fixa com chamada e botão de atendimento.
- **Promoção fixa independente** como o segundo bloco da home, exibida inteira, sem corte e sem texto por cima.
- Carrossel opcional de **até 4 destaques** da loja, editáveis, ordenáveis e removíveis, logo depois da promoção.
- Vitrine com filtros e cards que mostram somente foto e nome; preço, descrição e orçamento ficam na página do produto.
- Rodapé e chamada de WhatsApp coerentes com o novo layout.

## Painel do colaborador

Em **Home: destaques e promoção** há duas abas:

1. **Destaques da loja** — adicione até quatro imagens horizontais, altere a ordem ou remova cada uma. Eles aparecem depois da promoção.
2. **Promoção fixa** — envie um único banner promocional. Ele aparece logo depois das boas-vindas, inteiro e sem sobreposição.

O título de cada imagem é opcional. Basta imagem + a opção **Exibir esta imagem no site** marcada para publicar. Se uma imagem foi colocada no lugar errado, use **Usar como promoção** no destaque correspondente: isso substitui a promoção fixa e remove o item do carrossel.

## Instalação

Envie o arquivo compactado para `/root/` e execute o instalador contido nesta pasta. Ele valida os arquivos, cria uma cópia em `/var/backups/`, aguarda a API responder e restaura o servidor anterior se a inicialização falhar.

Depois da instalação, atualize a home com `Ctrl+F5` e abra `/cliente/` para administrar os destaques e a promoção.
