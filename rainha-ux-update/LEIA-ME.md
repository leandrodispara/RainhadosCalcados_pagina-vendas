# Atualização de banners · Rainha dos Calçados

Esta versão separa definitivamente os dois espaços da página inicial:

1. **Destaques da página inicial**: carrossel com até **3 banners removíveis**. O antigo banner principal é migrado automaticamente para o primeiro destaque.
2. **Banner fixo de promoções**: continua independente, abaixo dos destaques, sem sobreposição e com a imagem exibida inteira.

## O que muda no painel

Em **Banners da página inicial** existem duas abas:

- **Destaques da página inicial**: adicionar, editar, ocultar ou excluir até três banners.
- **Banner fixo de promoções**: cadastrar um único banner promocional separado.

Os arquivos enviados ao Google Drive continuam sendo usados normalmente. Nenhuma imagem existente é apagada pela atualização.

## Instalação no servidor

1. Envie a pasta \`rainha-ux-update\` desta atualização para \`/root/\`.
2. Execute como root:

~~~bash
cd /root/rainha-ux-update
bash -n install.sh && bash install.sh
~~~

O instalador:

- cria uma cópia de segurança em \`/var/backups/\`;
- valida os JavaScripts;
- aguarda a API responder antes de concluir;
- restaura API, painel, vitrine e catálogo caso a API não inicie.

Depois, atualize a página com **Ctrl+F5** e entre em:

- https://calcadosrainha.com.br/
- https://calcadosrainha.com.br/cliente/
