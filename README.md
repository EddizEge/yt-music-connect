# 🎵 YouTube Music Connect (v1.0.1)

[English](#english) | [Türkçe](#türkçe)

---

## English

**YouTube Music Connect** is a modern remote control system that allows you to control the YouTube Music player playing on your PC in real-time from your mobile phone or any other mobile device.

It is a fully customized, feature-rich YT Music clone built using Vite + React (Mobile interface) and Electron (Desktop client).

### 🌟 Key Features

* **📱 Advanced Mobile UI:** A modern React interface designed as a pixel-perfect replica of the official YouTube Music mobile app, complete with album covers, playlists, search engine, and artist profiles.
* **🔗 Instant QR Code Pairing:** Click the floating red QR icon on the PC player to display the connection URL and a dynamically generated QR code. Scan it with your phone's camera and connect instantly!
* **🔊 Persistent Volume (Volume Lock):** Protects your volume settings from being overwritten by YouTube Music's track-change auto-reset bug. The volume level set on your phone stays locked during track transitions.
* **🚦 Dynamic Port Scanning:** If port `8080` is in use on your PC, the app automatically scans for the next free port (`8081`, `8082`, etc.) and starts the Express server there. No port conflicts!
* **💬 Discord Rich Presence (RPC):** Showcases your active music status (song title, artist, and progress) on your Discord profile automatically.
* **📃 Up Next Queue Tracking:** Swipe up the mobile player to view the active queue of upcoming tracks synced from your PC.
* **⚙️ Integrated Update Checker:** Check for newer versions directly from the connection info modal and navigate straight to the GitHub releases download page with a single click.
* **📦 Standard Windows Installer:** Easy installation using the NSIS setup packaging, automatically creating a desktop shortcut with a custom red YT Music icon.

### 🚀 How to Install and Use

1. Download the latest **`YouTube Music Connect Setup 1.0.1.exe`** from the [Releases](https://github.com/EddizEge/yt-music-connect/releases) section.
2. Complete the installation on your Windows PC. Open the application using the red desktop shortcut.
3. Open the phone connection URL (e.g., `http://192.168.1.100:8080`) printed in the window's title bar, or click the red QR button in the bottom left corner and **scan the QR code with your phone**.
4. Make sure both your PC and mobile device are connected to the **same Wi-Fi network**.
5. *Tip:* After opening the page on your phone, select **"Add to Home Screen"** from your mobile browser settings to run it as a full-screen app.

---

## Türkçe

**YouTube Music Connect**, bilgisayarınızda çalan YouTube Music uygulamasını cep telefonunuzdan veya herhangi bir mobil cihazdan gerçek zamanlı olarak kontrol etmenizi sağlayan modern bir uzaktan kumanda (Remote Control) sistemidir. 

Vite + React (Mobil Arayüz) ve Electron (Masaüstü İstemcisi) teknolojileri kullanılarak geliştirilmiş, tamamen kişiselleştirilmiş ve zengin özelliklerle donatılmış bir YT Music klonudur.

### 🌟 Öne Çıkan Özellikler

* **📱 Gelişmiş Mobil Arayüz:** YouTube Music mobil uygulamasının birebir kopyası olarak tasarlanmış, albüm kapakları, çalma listeleri, arama motoru ve sanatçı profillerini barındıran modern React arayüzü.
* **🔗 Anında QR Bağlantısı:** Bilgisayar ekranındaki yüzen kırmızı QR butonuna basarak bağlantı adresini ve dinamik olarak oluşturulan QR kodunu görüntüleyin. Telefonunuzun kamerasıyla taratıp saniyeler içinde bağlanın!
* **🔊 Ses Seviyesi Koruyucusu (Volume Lock):** YouTube Music'in şarkı geçişlerindeki otomatik ses kısma/sıfırlama buglarını ezen koruma mekanizması. Telefonunuzdan ayarladığınız ses seviyesi şarkı değişse de asla bozulmaz.
* **🚦 Dinamik Port Tarayıcı:** Bilgisayarınızda `8080` portu doluysa, uygulama otomatik olarak sıradaki boş portu (`8081`, `8082` vb.) bulup Express sunucusunu oradan başlatır. Port çakışması yaşanmaz.
* **💬 Discord Zengin Varlık (RPC):** O an dinlediğiniz şarkıyı, sanatçıyı ve geçen süreyi Discord profilinizde havalı bir "YouTube Music dinliyor" durumu olarak gösterir.
* **📃 Sıradakiler Listesi (Up Next):** Oynatıcıyı yukarı kaydırarak sıradaki şarkıları telefondan anlık olarak listeleyebilirsiniz.
* **⚙️ Kolay Güncelleme Denetleyicisi:** Bağlantı panelindeki buton aracılığıyla yeni bir güncelleme olup olmadığını anında kontrol edebilir, yeni sürüm varsa doğrudan indirme sayfasına gidebilirsiniz.
* **📦 Kolay Kurulum:** Masaüstüne otomatik kısayol ve başlat menüsü entegrasyonu sağlayan kırmızı logolu kurulum paketi (NSIS).

### 🚀 Nasıl Kurulur ve Kullanılır?

1. Projenin [Releases](https://github.com/EddizEge/yt-music-connect/releases) bölümünden en güncel **`YouTube Music Connect Setup 1.0.1.exe`** dosyasını indirin.
2. Bilgisayarınıza kurulumu tamamlayın. Masaüstündeki kırmızı YouTube Music Connect kısayoluna çift tıklayarak uygulamayı açın.
3. Uygulamanın en üstündeki başlık barında veya sol alttaki kırmızı QR kod simgesine tıkladığınızda açılan panelde yazan URL'yi (örn: `http://192.168.1.100:8080`) telefonunuzun tarayıcısına yazın ya da **QR kodunu telefonunuza taratın**.
4. Telefonunuz ile bilgisayarınızın **aynı Wi-Fi ağına** bağlı olduğundan emin olun.
5. *İpucu:* Telefon tarayıcınızda bağlantıyı açtıktan sonra tarayıcı menüsünden **"Ana Ekrana Ekle" (Add to Home Screen)** diyerek tam ekran uygulama deneyimi yaşayabilirsiniz.

---

### 👨‍💻 Developer / Geliştirici
Developed with ❤️ by **Ediz Ege Mercan**.
