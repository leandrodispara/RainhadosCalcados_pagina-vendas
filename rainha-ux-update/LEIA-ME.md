# Atualização editorial — Rainha dos Calçados

Esta versão reconstrói a página inicial como uma vitrine editorial, inspirada na referência aprovada:

- Cabeçalho premium, hero com chamada e botão de atendimento.
- Carrossel de **até 4 destaques** de recepção, todos editáveis, ordenáveis e removíveis no painel.
- **Promoção fixa independente**, imediatamente abaixo dos destaques. A imagem é exibida inteira, sem corte e sem sobreposição.
- Vitrine com filtros, cards de produto, coleções feminina e masculina e área dedicada aos perfumes árabes.
- Rodapé e chamada de WhatsApp coerentes com o novo layout.

## Painel do colaborador

Em **Home: destaques e promoção** há duas abas:

1. **Destaques de recepção** — adicione até quatro imagens horizontais, altere a ordem ou remova cada uma.
2. **Promoção fixa** — envie um único banner promocional; ele nunca entra no carrossel e é mostrado completo abaixo dele.

O título de cada imagem é opcional. Basta imagem + a opção **Exibir esta imagem no site** marcada para publicar.

## Instalação

Envie o arquivo compactado para `/root/` e execute o instalador contido nesta pasta. Ele valida os arquivos, cria uma cópia em `/var/backups/`, aguarda a API responder e restaura o servidor anterior se a inicialização falhar.

Depois da instalação, atualize a home com `Ctrl+F5` e abra `/cliente/` para administrar os destaques e a promoção.
