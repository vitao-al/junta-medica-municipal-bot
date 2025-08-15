const venom = require('venom-bot');
const fs = require('fs');
const { appendFileSync } = require('fs');

venom
  .create({
    session: 'junta-medica-session',
    headless: false,
    useChrome: true,
    disableAutoRead: true,
  })
  .then((client) => start(client))
  .catch((erro) => console.log(erro));

const usersData = {};

function start(client) {
  client.onMessage(async (message) => {
    const userId = message.from;

    if (!usersData[userId]) {
      usersData[userId] = { step: 0 };
    }

    const user = usersData[userId];

    console.log(`Mensagem recebida: ${message.body} | Etapa: ${user.step}`);
    const palavrasChave = ['agendar', 'perícia', 'agendamento', 'médica', 'junta'];
    const resposta = message.body.split(' ');

    if (message.body.toLowerCase() === 'sair') {
      await client.sendText(userId, '*Agendamento cancelado!*\nSe quiser iniciar novamente, envie mensagem sobre agendamento.');
      user.step = 0;
      return;
    }

    if (resposta.some(palavra => palavrasChave.includes(palavra)) && user.step === 0) {
      await client.sendImage(
        userId,
        './assets/bela-bot.jpg',
        'clara-bot.jpg',
        '👋 Olá! Meu nome é *_Bela_*, sou a assistente virtual da *Junta Médica Municipal de Maceió*.\n\nVamos iniciar seu agendamento?\n\nPor favor, me informe seu *nome completo*.'
      );
      user.step = 1;
      return;
    }

    if (user.step === 1) {
      if (!/^[A-Za-zÀ-ÿ]+(?: [A-Za-zÀ-ÿ]+)+$/.test(message.body.trim())) {
        await client.sendText(userId, 'Por favor, informe um *nome completo* válido (ex: João da Silva).');
        return;
      }
      user.nome = message.body.trim();
      await client.sendText(userId, '*Informe seu número de matrícula*:');
      user.step = 2;
      return;
    }

    if (user.step === 2) {
      if (!/^\d{4,10}$/.test(message.body.trim())) {
        await client.sendText(userId, 'Por favor, informe um *número de matrícula* válido (apenas números, 4 a 10 dígitos).');
        return;
      }
      user.numInscricao = message.body.trim();
      await client.sendText(userId, 'Informe seu *CPF*:');
      user.step = 3;
      return;
    }

    if (user.step === 3) {
      if (!/^(\d{3}\.\d{3}\.\d{3}-\d{2}|\d{11})$/.test(message.body.trim())) {
        await client.sendText(userId, 'Por favor, informe um *CPF* válido (ex: 123.456.789-00 ou 12345678900).');
        return;
      }
      user.cpf = message.body.trim();
      await client.sendText(
        userId,
        '*Qual é a sua secretária?*\n*1 - SEMED* - Secretaria Municipal de Educação\n*2 - SMS* - Secretaria Municipal da Saúde\n*3 - SEMGE* - Secretaria Municipal de Gestão de Pessoas e Patrimônio\n*4 - SEMSCS* - Secretaria Municipal de Segurança Cidadã'
      );
      user.step = 4;
      return;
    }

    if (user.step === 4) {
      let secretaria = '';
      switch (message.body.trim()) {
        case '1':
          secretaria = 'SEMED';
          break;
        case '2':
          secretaria = 'SMS';
          break;
        case '3':
          secretaria = 'SEMGE';
          break;
        case '4':
          secretaria = 'SEMSCS';
          break;
        default:
          await client.sendText(userId, "*Opção inválida*. Por favor, escolha uma das opções acima.");
          return;
      }
      user.secretaria = secretaria;
      await client.sendText(userId, `Você escolheu: *${user.secretaria}*`);
      await client.sendText(
        userId,
        '*Qual é o motivo do seu agendamento?*\n*1 - Afastamento*\n*2 - Readaptação*\n*3 - Processos*\n*4 - Outro*\nDigite o *NÚMERO* correspondente à opção desejada.'
      );
      user.step = 5;
      return;
    }

    if (user.step === 5) {
      let pretexto = '';
      switch (message.body.trim()) {
        case '1':
          pretexto = 'Afastamento';
          break;
        case '2':
          pretexto = 'Readaptação';
          break;
        case '3':
          pretexto = 'Processos';
          break;
        case '4':
          pretexto = 'Outro';
          break;
        default:
          await client.sendText(userId, "*Opção inválida*. Por favor, escolha uma das opções acima.");
          return;
      }
      user.pretexto = pretexto;
      await client.sendText(userId, `Você escolheu: *${user.pretexto}*\nAgora, por favor, envie uma foto ou PDF do atestado.`);
      user.step = 6;
      return;
    }

    if (user.step === 6) {
      if (message.mimetype) {
        try {
          const buffer = await client.decryptFile(message); // aqui garante a qualidade total do arquivo
          const extension = message.mimetype.split('/')[1];
          const fileName = `${user.nome.replace(/\s/g, "_")}_${Date.now()}.${extension}`;
          const filePath = `./atestados/${fileName}`;

          fs.writeFileSync(filePath, buffer);
          user.atestadoPath = filePath;

          const row = `${user.nome};${user.numInscricao};${user.cpf};${user.secretaria};${user.pretexto};${filePath}\n`;
          appendFileSync('agendamentos.csv', row, 'utf8');

          await client.sendText(userId, 'Atestado recebido! Obrigado, sua solicitação foi registrada com sucesso.');
          user.step = 0;
        } catch (error) {
          console.error('Erro ao salvar o atestado:', error);
          await client.sendText(userId, '❌ Ocorreu um erro ao salvar o atestado. Por favor, tente novamente.');
        }
      } else {
        await client.sendText(userId, 'Por favor, envie o atestado como imagem ou PDF (via anexo).');
      }
      return;
    }
  });
}
