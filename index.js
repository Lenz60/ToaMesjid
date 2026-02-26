const { Client, GatewayIntentBits, AttachmentBuilder } = require("discord.js");
const ChannelID = require("./ChannelID");
require("dotenv").config();
const cron = require("node-cron");
const path = require("path");
const axios = require("axios");
const { error } = require("console");

const client = new Client({
  disableMentions: "everyone",
  restTimeOffset: 0,
  intents: [
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.Guilds,
    GatewayIntentBits.MessageContent,
  ],
});

client.login(process.env.TOKEN);

client.on("warn", (info) => console.log(info));
client.on("error", console.error);
client.on("ready", () => {
  const channel = client.channels.cache.get(ChannelID.TestChannelID);
  console.log(`${client.user.username} ready!`);
  channel.send("Toa Mesjid Online 🔈🔉🔊");
});

// Add this function before the messageCreate event
async function fetchImsakiyah(provinsi, kabkota) {
  try {
    const response = await axios.post("https://equran.id/api/v2/imsakiyah", {
      provinsi,
      kabkota,
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching imsakiyah for ${kabkota}:`, error);
    return null;
  }
}

function getCurrentDate() {
  return new Date().getDate();
}

function extractImsakiyahData(apiResponse, currentDate) {
  if (!apiResponse || !apiResponse.data) return null;

  const { kabkota, imsakiyah } = apiResponse.data;
  const todaySchedule = imsakiyah.find(
    (schedule) => schedule.tanggal === currentDate
  );

  if (!todaySchedule) return null;

  return {
    kabkota,
    tanggal: todaySchedule.tanggal,
    imsak: todaySchedule.imsak,
    subuh: todaySchedule.subuh,
    maghrib: todaySchedule.maghrib,
  };
}

async function initializeImsakiyahData() {
  const currentDate = getCurrentDate();

  const locations = [
    { name: "bantul", provinsi: "D.I. Yogyakarta", kabkota: "Kab. Bantul" },
    { name: "sleman", provinsi: "D.I. Yogyakarta", kabkota: "Kab. Sleman" },
    { name: "jogja", provinsi: "D.I. Yogyakarta", kabkota: "Kota Yogyakarta" },
    {
      name: "samarinda",
      provinsi: "Kalimantan Timur",
      kabkota: "Kota Samarinda",
    },
    { name: "jakarta", provinsi: "DKI Jakarta", kabkota: "Kota Jakarta" },
    { name: "tangerang", provinsi: "Banten", kabkota: "Kab. Tangerang" },
  ];

  const imsakiyahData = {};

  for (const location of locations) {
    const apiResponse = await fetchImsakiyah(
      location.provinsi,
      location.kabkota
    );
    const extractedData = extractImsakiyahData(apiResponse, currentDate);
    imsakiyahData[
      `imsakiyah${
        location.name.charAt(0).toUpperCase() + location.name.slice(1)
      }Now`
    ] = extractedData;
  }

  return imsakiyahData;
}

function calculateCountdownToMaghrib(maghribTime) {
  const now = new Date();
  const [hours, minutes] = maghribTime.split(":").map(Number);
  const maghribDateTime = new Date(now);
  maghribDateTime.setHours(hours, minutes, 0, 0);

  const diffMs = maghribDateTime.getTime() - now.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes > 60) {
    const hours = Math.floor(diffMinutes / 60);
    const remainingMinutes = diffMinutes % 60;
    if (remainingMinutes > 0) {
      return `sabar bos ${hours} jam ${remainingMinutes} menit lagi buka (WIB)`;
    } else {
      return `sabar bos ${hours} jam lagi buka (WIB)`;
    }
  } else {
    return `sabar bos ${diffMinutes} menit lagi buka (WIB)`;
  }
}

function formatMaghribTimes(imsakiyahData) {
  const maghribTimes = [
    `Bantul : ${imsakiyahData.imsakiyahBantulNow?.maghrib || "N/A"} WIB`,
    `Sleman : ${imsakiyahData.imsakiyahSlemanNow?.maghrib || "N/A"} WIB`,
    `Jogja : ${imsakiyahData.imsakiyahJogjaNow?.maghrib || "N/A"} WIB`,
    `Samarinda : ${imsakiyahData.imsakiyahSamarindaNow?.maghrib || "N/A"} WIB`,
    `Jakarta : ${imsakiyahData.imsakiyahJakartaNow?.maghrib || "N/A"} WIB`,
    `Tangerang : ${imsakiyahData.imsakiyahTangerangNow?.maghrib || "N/A"} WIB`,
  ].join("\n");

  return maghribTimes;
}

function formatImsakTimes(imsakiyahData) {
  const imsakTimes = [
    `Bantul : ${imsakiyahData.imsakiyahBantulNow?.imsak || "N/A"} WIB`,
    `Sleman : ${imsakiyahData.imsakiyahSlemanNow?.imsak || "N/A"} WIB`,
    `Jogja : ${imsakiyahData.imsakiyahJogjaNow?.imsak || "N/A"} WIB`,
    `Samarinda : ${imsakiyahData.imsakiyahSamarindaNow?.imsak || "N/A"} WIT`,
    `Jakarta : ${imsakiyahData.imsakiyahJakartaNow?.imsak || "N/A"} WIB`,
    `Tangerang : ${imsakiyahData.imsakiyahTangerangNow?.imsak || "N/A"} WIB`,
  ].join("\n");

  return imsakTimes;
}

function calculateCountdownToImsak(imsakTime) {
  const now = new Date();
  const [hours, minutes] = imsakTime.split(":").map(Number);
  const imsakDateTime = new Date(now);
  imsakDateTime.setHours(hours, minutes, 0, 0);

  // If imsak time is tomorrow (current time is after 19:00 and imsak is early morning)
  if (now.getHours() >= 19 && hours < 12) {
    imsakDateTime.setDate(imsakDateTime.getDate() + 1);
  }

  const diffMs = imsakDateTime.getTime() - now.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes > 60) {
    const hours = Math.floor(diffMinutes / 60);
    const remainingMinutes = diffMinutes % 60;
    if (remainingMinutes > 0) {
      return `ya makan anjir, masih ${hours} jam ${remainingMinutes} menit sebelom imsak (WIB)`;
    } else {
      return `ya makan anjir, masih ${hours} jam sebelom imsak (WIB)`;
    }
  } else {
    return `ya makan anjir, masih ${diffMinutes} menit sebelom imsak (WIB)`;
  }
}

function isWithinFastingHours() {
  const now = new Date();
  const currentHour = now.getHours();
  return currentHour >= 5 && currentHour < 17;
}

function isWithinSahurHours() {
  const now = new Date();
  const currentHour = now.getHours();
  // 19:00 (7 PM) to 02:00 (2 AM) - crosses midnight
  return currentHour >= 19 || currentHour < 2;
}

async function handleLaparMessage(channel, laparImagePath, makanImagePath) {
  const imsakiyahData = await initializeImsakiyahData();

  // Check if all API calls failed
  const allDataFailed =
    !imsakiyahData.imsakiyahBantulNow &&
    !imsakiyahData.imsakiyahSlemanNow &&
    !imsakiyahData.imsakiyahJogjaNow &&
    !imsakiyahData.imsakiyahSamarindaNow &&
    !imsakiyahData.imsakiyahJakartaNow &&
    !imsakiyahData.imsakiyahTangerangNow;

  if (allDataFailed) {
    await channel.send({
      content: "Marbot mesjid kabur, printer rusak",
    });
    return;
  }

  if (isWithinFastingHours()) {
    const attachment = new AttachmentBuilder(laparImagePath, {
      name: "lapar.jpg",
    });
    // Existing maghrib countdown logic
    const jakartaMaghrib = imsakiyahData.imsakiyahJakartaNow?.maghrib;
    const bantulMaghrib = imsakiyahData.imsakiyahBantulNow?.maghrib;
    const slemanMaghrib = imsakiyahData.imsakiyahSlemanNow?.maghrib;
    const jogjaMaghrib = imsakiyahData.imsakiyahJogjaNow?.maghrib;
    const samarindaMaghrib = imsakiyahData.imsakiyahSamarindaNow?.maghrib;
    const tangerangMaghrib = imsakiyahData.imsakiyahTangerangNow?.maghrib;

    if (
      jakartaMaghrib ||
      bantulMaghrib ||
      slemanMaghrib ||
      jogjaMaghrib ||
      samarindaMaghrib ||
      tangerangMaghrib
    ) {
      const referenceMaghrib =
        jakartaMaghrib ||
        bantulMaghrib ||
        slemanMaghrib ||
        jogjaMaghrib ||
        samarindaMaghrib ||
        tangerangMaghrib;

      const countdownText = calculateCountdownToMaghrib(referenceMaghrib);
      const maghribTimes = formatMaghribTimes(imsakiyahData);
      const messageContent = `${countdownText}\n\n${maghribTimes}`;

      await channel.send({
        content: messageContent,
        files: [attachment],
      });
    } else {
      await channel.send({
        content: "Data maghrib tidak tersedia",
      });
    }
  } else if (isWithinSahurHours()) {
    const attachment = new AttachmentBuilder(makanImagePath, {
      name: "kerupuk.jpg",
    });
    // New imsak countdown logic
    const jakartaImsak = imsakiyahData.imsakiyahJakartaNow?.imsak;
    const bantulImsak = imsakiyahData.imsakiyahBantulNow?.imsak;
    const slemanImsak = imsakiyahData.imsakiyahSlemanNow?.imsak;
    const jogjaImsak = imsakiyahData.imsakiyahJogjaNow?.imsak;
    const samarindaImsak = imsakiyahData.imsakiyahSamarindaNow?.imsak;
    const tangerangImsak = imsakiyahData.imsakiyahTangerangNow?.imsak;

    if (
      jakartaImsak ||
      bantulImsak ||
      slemanImsak ||
      jogjaImsak ||
      samarindaImsak ||
      tangerangImsak
    ) {
      const referenceImsak =
        jakartaImsak ||
        bantulImsak ||
        slemanImsak ||
        jogjaImsak ||
        samarindaImsak ||
        tangerangImsak;

      const countdownText = calculateCountdownToImsak(referenceImsak);
      const imsakTimes = formatImsakTimes(imsakiyahData);
      const messageContent = `${countdownText}\n\n${imsakTimes}`;

      await channel.send({
        content: messageContent,
        files: [attachment],
      });
    } else {
      await channel.send({
        content: "Data imsak tidak tersedia",
      });
    }
  } else {
    await channel.send({
      content: "Mesjid sepi",
    });
  }
}

client.on("messageCreate", async (message) => {
  const channel = client.channels.cache.get(ChannelID.TestChannelID);
  if (message.author.bot) return;
  const content = message.content;

  const imagePath = path.join(__dirname, "assets", "images");
  const laparImagePath = path.join(imagePath, "lapar.jpg");
  const makanImagePath = path.join(imagePath, "kerupuk.jpg");

  const lapar = /(^| |\"|\')lapar nich( |$|\.|\,|!|\?|\:|\;|\"|\')/i;
  if (lapar.test(content) || content.includes("796773828059201616")) {
    await handleLaparMessage(channel, laparImagePath, makanImagePath);
    return;
  }
});

function sahurAlert() {
  // Schedule for 3:00 AM Jakarta time (UTC+7) every day
  cron.schedule(
    "0 3 * * *",
    async () => {
      try {
        // const channel = client.channels.cache.get(ChannelID.BotChannelID);
        const channel = client.channels.cache.get(ChannelID.TestChannelID);

        if (!channel) {
          console.error("Channel not found");
          return;
        }

        const videoPath = path.join(__dirname, "assets", "videos", "sahur.mp4");
        const attachment = new AttachmentBuilder(videoPath, {
          name: "sahur.mp4",
        });

        await channel.send({
          content: "Sahur",
          files: [attachment],
        });

        console.log("Sahur alert sent successfully");
      } catch (error) {
        console.error("Error sending sahur alert:", error);
      }
    },
    {
      scheduled: true,
      timezone: "Asia/Jakarta",
    }
  );
}
sahurAlert();

process.stdin.resume();
//Close Message When the bot is turned off or killed the process
//Delay close for 3 seconds function
const timeoutclose = setTimeout(function () {
  console.log("3 seconds delay when closed");
}, 3000);
//Sleep for ctrl+C
// function sleep(time) {
//   return new Promise((resolve) => setTimeout(resolve, time));
// }
// process.on("SIGHUP", function () {
//   const channel = client.channels.cache.get(ChannelID.GeneralID);
//   channel.send("Pengharum Ruangan Offline");
// });
// process.on("SIGINT", function () {
//   const channel = client.channels.cache.get(ChannelID.GeneralID);
//   channel.send("Pengharum Ruangan Offline");
//   sleep(3000).then(() => {
//     process.exit(0);
//   });
// });
// process.on("SIGTERM", function () {
//   const channel = client.channels.cache.get(ChannelID.GeneralID);
//   channel.send("Pengharum Ruangan Offline");
// });
// process.on("SIGKILL", function () {
//   const channel = client.channels.cache.get(ChannelID.GeneralID);
//   channel.send("Pengharum Ruangan Offline");
// });
// process.on("SIGUSR1", async function () {
//   const channel = client.channels.cache.get(ChannelID.GeneralID);
//   channel.send("Pengharum Ruangan Offline");
// });
// process.on("SIGUSR2", async function () {
//   const channel = client.channels.cache.get(ChannelID.GeneralID);
//   channel.send("Pengharum Ruangan Offline");
// });
// process.on("exit", function () {
//   const channel = client.channels.cache.get(ChannelID.GeneralID);
//   channel.send("Pengharum Ruangan Offline");
// });
// process.on("uncaughtException", async function () {
//   const channel = client.channels.cache.get(ChannelID.GeneralID);
//   channel.send("Pengharum Ruangan Offline");
// });
