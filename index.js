const Imap = require('imap');
const simpleParser = require('mailparser').simpleParser;
const fs = require('fs');
const printer = require('node-printer');
const nodemailer = require('nodemailer');

// Configurations de la boîte mail
const imapConfig = {
  user: '',
  password: '',
  host: '',
  port: 993,
  tls: true
};

// Configurations pour le service SMTP
const smtpConfig = {
    host: '',
    port: 465,
    secure: true,
    auth: {
      user: '',
      pass: ''
    }
  };

const transporter = nodemailer.createTransport(smtpConfig);

// Liste des expéditeurs autorisés
const expeditorsWhitelist = ['', ''];

// Fonction principale pour se connecter à la boîte mail et traiter les emails
function connectAndCheckMail() {
  const imap = new Imap(imapConfig);

  imap.once('ready', () => {
    imap.openBox('INBOX', true, (err, box) => {
      if (err) throw err;

      // Recherche des nouveaux emails non lus
      imap.search(['UNSEEN'], (searchErr, results) => {
        if (searchErr) throw searchErr;

        const fetch = imap.fetch(results, { bodies: '' });

        fetch.on('message', (msg) => {
          msg.on('body', (stream) => {
            simpleParser(stream, (parseErr, parsed) => {
              if (parseErr) throw parseErr;

              // Vérification de l'expéditeur dans la liste blanche
              const senderEmail = parsed.from.text;
              if (expeditorsWhitelist.includes(senderEmail)) {
                // Vérification des pièces jointes
                if (parsed.attachments && parsed.attachments.length > 0) {
                  parsed.attachments.forEach((attachment, index) => {
                    // Imprimer la pièce jointe
                    printAttachment(attachment.content, attachment.filename);

                    imap.setFlags(msg.seqno, ['\\Seen'], (err) => {
                        if (err) throw err;
                        console.log('Email marqué comme lu avec succès.');
                    });

                    // Envoyer un email à l'expéditeur
                    sendEmail(senderEmail, 'Impression lancée avec succès', 'Votre document est en cours d\'impression.');
                  });
                }
              } else {
                console.log(`Email de l'expéditeur non autorisé: ${senderEmail}`);

                imap.setFlags(msg.seqno, ['\\Seen'], (err) => {
                    if (err) throw err;
                    console.log('Email marqué comme lu avec succès.');
                });

                sendEmail(senderEmail, 'Impression refusée', 'Vous n\'êtes pas autorisé à utiliser ce service d\'impression.');
              }
            });
          });
        });

        fetch.on('end', () => {
          imap.end();
        });
      });
    });
  });

  imap.once('error', (err) => {
    console.log(err);
  });

  imap.once('end', () => {
    console.log('Fermeture de la connexion.');
  });

  imap.connect();
}

// Fonction pour imprimer la pièce jointe
function printAttachment(content, filename) {
    const printerName = ''; // Nom de l'imprimante
  
    const filePath = `./${filename}`;
    fs.writeFileSync(filePath, content);
  
    const jobFromBuffer = printer.printDirect({
      data: fs.readFileSync(filePath),
      printer: printerName,
      type: 'RAW',
      success: (jobID) => {
        console.log(`Impression réussie. Job ID: ${jobID}`);
        fs.unlinkSync(filePath); // Supprimer le fichier après impression
      },
      error: (err) => {
        console.error('Erreur d\'impression:', err);
      }
    });
  
    console.log('Job ID:', jobFromBuffer);
  }

// Appeler la fonction principale
connectAndCheckMail();
