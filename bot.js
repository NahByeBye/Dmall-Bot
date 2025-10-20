const {
  Client, GatewayIntentBits, PermissionsBitField,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, EmbedBuilder
} = require('discord.js');

const TOKEN = ''; // Put ur token here 
const DELAY = 5000;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

const configs = {};

function log(type, msg) {
  const date = new Date().toLocaleString('fr-FR');
  switch (type) {
    case 'INFO':
      console.log(`[INFO - ${date}] ${msg}`);
      break;
    case 'WARN':
      console.warn(`[WARN - ${date}] ${msg}`);
      break;
    case 'ERROR':
      console.error(`[ERROR - ${date}] ${msg}`);
      break;
    case 'DMALL':
      console.log(`[DM ALL - ${date}] ${msg}`);
      break;
    case 'CONFIG':
      console.log(`[CONFIG - ${date}] ${msg}`);
      break;
    default:
      console.log(`[LOG - ${date}] ${msg}`);
  }
}


function getMenuEmbed(userId) {
  const conf = configs[userId];
  return new EmbedBuilder()
    .setTitle('📢 DM All - Configuration')
    .setDescription(
      `**Exclus :** ${conf.idsToExclude.length ? conf.idsToExclude.join(', ') : 'Aucun'}\n` +
      `**Message :** ${conf.messageContent}\n` +
      `**Mention ?** ${conf.mentionUser ? '✅' : '❌'}\n` +
      `**Mode Embed :** ${conf.useEmbed ? '✅' : '❌'}\n`
    )
    .setColor(conf.useEmbed ? conf.embed.color : '#5865F2');
}

function getMainRows(conf) {
  const btnExclude = new ButtonBuilder().setCustomId('exclude_ids').setLabel('Exclure membres (IDs)').setStyle(ButtonStyle.Primary);
  const btnMessage = new ButtonBuilder().setCustomId('config_text').setLabel('Configurer Message').setStyle(ButtonStyle.Secondary);
  const btnMention = new ButtonBuilder().setCustomId('toggle_mention').setLabel(`Mention : ${conf.mentionUser ? 'ON' : 'OFF'}`).setStyle(conf.mentionUser ? ButtonStyle.Success : ButtonStyle.Secondary);
  const btnToggleEmbed = new ButtonBuilder().setCustomId('toggle_embed').setLabel(`Mode Embed : ${conf.useEmbed ? 'ON' : 'OFF'}`).setStyle(conf.useEmbed ? ButtonStyle.Success : ButtonStyle.Secondary);
  const btnEmbedConfig = new ButtonBuilder().setCustomId('config_embed').setLabel('Configurer Embed').setStyle(ButtonStyle.Success);
  const row1 = new ActionRowBuilder().addComponents(btnExclude, btnMessage, btnMention, btnToggleEmbed, btnEmbedConfig);
  const btnPreviewEmbed = new ButtonBuilder().setCustomId('preview_embed').setLabel('Aperçu Embed').setStyle(ButtonStyle.Primary);
  const btnSend = new ButtonBuilder().setCustomId('confirm_send').setLabel('Envoyer').setStyle(ButtonStyle.Danger);
  const row2 = new ActionRowBuilder().addComponents(btnPreviewEmbed, btnSend);
  return [row1, row2];
}

function getEmbedMenuRows() {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('embed_menu')
    .setPlaceholder('Choisis quoi modifier')
    .addOptions([
      { label: 'Titre', value: 'title' },
      { label: 'Description', value: 'description' },
      { label: 'Couleur', value: 'color' },
      { label: 'Ajouter un field', value: 'add_field' },
      { label: 'Supprimer un field', value: 'del_field' },
      { label: 'Footer', value: 'footer' }
    ]);
  const rowMenu = new ActionRowBuilder().addComponents(selectMenu);
  const btnBack = new ButtonBuilder()
    .setCustomId('embed_back')
    .setLabel('Retour')
    .setStyle(ButtonStyle.Secondary);
  const rowBack = new ActionRowBuilder().addComponents(btnBack);
  return [rowMenu, rowBack];
}

function getEmbedPreview(embedData) {
  const embed = new EmbedBuilder()
    .setTitle(embedData.title)
    .setDescription(embedData.description)
    .setColor(embedData.color || '#5865F2')
    .setFooter({ text: embedData.footer || '' });
  if (embedData.fields && embedData.fields.length) {
    embedData.fields.forEach(f => embed.addFields(f));
  }
  return embed;
}


client.once('ready', () => {
  log('INFO', `Bot connecté en tant que ${client.user.tag}`);
});

client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;

  if (message.content === '+invite') {
    const invite = `https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`;
    await message.reply({ content: `💡 **Lien d'invitation du bot :**\n${invite}` });
    log('INFO', `Lien d'invitation généré pour ${message.author.tag}: ${invite}`);
    return;
  }

  if (message.content === '+dmall') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      log('WARN', `Tentative d'utilisation par ${message.author.tag} sans permission.`);
      return message.reply("❌ Seuls les administrateurs peuvent utiliser cette commande.");
    }

    configs[message.author.id] = {
      idsToExclude: [],
      mentionUser: false,
      useEmbed: false,
      step: null,
      messageContent: "Ceci est un message par défaut.",
      embed: {
        title: 'Titre par défaut',
        description: 'Description par défaut',
        color: '#00BFFF',
        footer: 'Footer par défaut',
        fields: []
      },
      previewMsg: null
    };

    log('CONFIG', `Initialisation du menu DM all pour ${message.author.tag}`);

    const preview = await message.reply({
      embeds: [getMenuEmbed(message.author.id)],
      components: getMainRows(configs[message.author.id])
    });

    configs[message.author.id].previewMsg = preview;
  }

  const userId = message.author.id;
  if (configs[userId] && configs[userId].step) {
    const conf = configs[userId];
    let updated = false;

    switch (conf.step.type) {
      case 'exclude_ids':
        conf.idsToExclude = message.content.split(',').map(id => id.trim()).filter(id => /^\d+$/.test(id));
        log('CONFIG', `${message.author.tag} a exclu : ${conf.idsToExclude.join(', ') || 'aucun'}`);
        updated = true;
        break;
      case 'config_text':
        conf.messageContent = message.content;
        log('CONFIG', `${message.author.tag} a modifié le message texte.`);
        updated = true;
        break;
      case 'embed_title':
        conf.embed.title = message.content;
        log('CONFIG', `${message.author.tag} a modifié le titre de l'embed.`);
        updated = true;
        break;
      case 'embed_description':
        conf.embed.description = message.content;
        log('CONFIG', `${message.author.tag} a modifié la description de l'embed.`);
        updated = true;
        break;
      case 'embed_color':
        if (/^#?[0-9a-fA-F]{6}$/.test(message.content)) {
          conf.embed.color = message.content.startsWith('#') ? message.content : `#${message.content}`;
          log('CONFIG', `${message.author.tag} a modifié la couleur de l'embed: ${conf.embed.color}`);
          updated = true;
        }
        break;
      case 'embed_footer':
        conf.embed.footer = message.content;
        log('CONFIG', `${message.author.tag} a modifié le footer de l'embed.`);
        updated = true;
        break;
      case 'embed_add_field':
        const [fname, ...fval] = message.content.split('::');
        if (fname && fval.length) {
          conf.embed.fields.push({ name: fname.trim(), value: fval.join('::').trim() });
          log('CONFIG', `${message.author.tag} a ajouté un field à l'embed: ${fname.trim()} :: ${fval.join('::').trim()}`);
          updated = true;
        }
        break;
      case 'embed_del_field':
        const idx = conf.embed.fields.findIndex(f => f.name === message.content.trim());
        if (idx !== -1) {
          log('CONFIG', `${message.author.tag} a supprimé le field: ${conf.embed.fields[idx].name}`);
          conf.embed.fields.splice(idx, 1);
          updated = true;
        }
        break;
    }
    if (updated) {
      if (conf.step.type.startsWith('embed_')) {
        await conf.previewMsg.edit({ embeds: [getEmbedPreview(conf.embed)], components: getEmbedMenuRows() });
      } else {
        await conf.previewMsg.edit({ embeds: [getMenuEmbed(userId)], components: getMainRows(conf) });
      }
      await message.delete();
      conf.step = null;
    } else {
      log('WARN', `Format incorrect par ${message.author.tag} : ${message.content}`);
      await message.reply("❌ Format incorrect.");
    }
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;
  const userId = interaction.user.id;
  if (!configs[userId]) return;
  const conf = configs[userId];

  if (interaction.isButton()) {
    if (interaction.customId === 'exclude_ids') {
      conf.step = { type: 'exclude_ids' };
      log('INFO', `${interaction.user.tag} configure l'exclusion.`);
      return await interaction.reply({ content: 'Envoie dans le chat les IDs à exclure séparés par des virgules.', flags: 64 });
    }
    if (interaction.customId === 'config_text') {
      conf.step = { type: 'config_text' };
      log('INFO', `${interaction.user.tag} configure le message texte.`);
      return await interaction.reply({ content: 'Envoie dans le chat le message à envoyer.', flags: 64 });
    }
    if (interaction.customId === 'toggle_mention') {
      conf.mentionUser = !conf.mentionUser;
      log('CONFIG', `${interaction.user.tag} a togglé la mention: ${conf.mentionUser ? 'ON' : 'OFF'}`);
      await conf.previewMsg.edit({ embeds: [getMenuEmbed(userId)], components: getMainRows(conf) });
      await interaction.deferUpdate();
      return;
    }
    if (interaction.customId === 'toggle_embed') {
      conf.useEmbed = !conf.useEmbed;
      log('CONFIG', `${interaction.user.tag} a togglé le mode embed: ${conf.useEmbed ? 'ON' : 'OFF'}`);
      await conf.previewMsg.edit({ embeds: [getMenuEmbed(userId)], components: getMainRows(conf) });
      await interaction.deferUpdate();
      return;
    }
    if (interaction.customId === 'config_embed') {
      log('INFO', `${interaction.user.tag} ouvre la config embed.`);
      await conf.previewMsg.edit({ embeds: [getEmbedPreview(conf.embed)], components: getEmbedMenuRows() });
      return await interaction.reply({ content: 'Menu Embed ouvert ! Sélectionne une option.', flags: 64 });
    }
    if (interaction.customId === 'preview_embed') {
      log('INFO', `${interaction.user.tag} demande l\'aperçu embed.`);
      return await interaction.reply({ embeds: [getEmbedPreview(conf.embed)], flags: 64 });
    }
    if (interaction.customId === 'confirm_send') {
      log('DMALL', `${interaction.user.tag} lance l'envoi DM all...`);
      await interaction.reply({ content: "⏳ Envoi en cours...", flags: 64 });

      await interaction.guild.members.fetch();
      const members = interaction.guild.members.cache.filter(m => !m.user.bot && !conf.idsToExclude.includes(m.id));

      let success = 0, fail = 0, failList = [];
      for (const member of members.values()) {
        try {
          if (conf.useEmbed) {
            const embed = getEmbedPreview(conf.embed);
            await member.send({
              content: conf.mentionUser ? `<@${member.id}>` : undefined,
              embeds: [embed]
            });
          } else {
            let toSend = conf.messageContent;
            if (conf.mentionUser) toSend = `<@${member.id}>\n${toSend}`;
            await member.send(toSend);
          }
          success++;
          log('DMALL', `Message envoyé à ${member.user.tag} (${member.id})`);
        } catch (e) {
          fail++;
          failList.push(`${member.user.tag} (${member.id})`);
          log('ERROR', `Échec d'envoi à ${member.user.tag} (${member.id})`);
        }
        await new Promise(res => setTimeout(res, DELAY));
      }

      let result = `✅ Message envoyé à ${success} membres.\n❌ Échecs : ${fail}`;
      if (failList.length) {
        result += `\nMembres n'ayant pas reçu le message (MP bloqué ou erreur) :\n${failList.join('\n')}`;
      }
      await interaction.followUp({ content: result, flags: 64 });
      log('DMALL', `Résultat: ${success} succès, ${fail} échecs.`);
      if (failList.length) log('ERROR', `Liste des échecs: ${failList.join(', ')}`);
      log('DMALL', `Exclus : ${conf.idsToExclude.length ? conf.idsToExclude.join(', ') : 'aucun'}`);
    }
    if (interaction.customId === 'embed_back') {
      log('CONFIG', `${interaction.user.tag} revient au menu principal.`);
      await conf.previewMsg.edit({ embeds: [getMenuEmbed(userId)], components: getMainRows(conf) });
      await interaction.reply({ content: 'Retour au menu principal.', flags: 64 });
      return;
    }
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'embed_menu') {
    const type = interaction.values[0];
    conf.step = { type: `embed_${type}` };

    let msg = '';
    switch (type) {
      case 'title': msg = "Envoie le nouveau titre dans le chat."; break;
      case 'description': msg = "Envoie la nouvelle description dans le chat."; break;
      case 'color': msg = "Envoie la couleur hexadécimale (#xxxxxx) dans le chat."; break;
      case 'footer': msg = "Envoie le footer dans le chat."; break;
      case 'add_field': msg = "Envoie le field sous la forme : nom::valeur"; break;
      case 'del_field': msg = "Envoie le nom du field à supprimer."; break;
    }
    log('CONFIG', `${interaction.user.tag} modifie l'embed (${type}).`);
    await interaction.reply({ content: msg, flags: 64 });
  }
});


client.login(TOKEN);
