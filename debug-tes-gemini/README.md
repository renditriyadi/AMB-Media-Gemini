# Debug Test Gemini: `refreshCreds`

## Status analisis

Endpoint `https://signaler-pa.clients6.google.com/punctual/v1/refreshCreds` terlihat sebagai endpoint internal Google bernama `refreshCreds`. Berdasarkan nama dan parameter request, dugaan paling aman adalah endpoint ini membantu memperbarui kredensial/sesi untuk komponen web Google yang memakai layanan Punctual.

Ini bukan endpoint pembacaan riwayat video atau saldo kredit Gemini. Parameter `key`, `gsessionid`, header `SAPISIDHASH`, cookies, dan body protobuf/JSON yang opak menunjukkan request bergantung pada sesi browser. Format dan arti body belum dapat dipastikan dari URL saja; endpoint internal dapat berubah tanpa kontrak publik.

## Rencana uji aman

Request dengan sesi yang dikirim di percakapan tidak dijalankan. Untuk pengujian yang diotorisasi:

1. Cabut sesi Google yang terekspos dengan logout/revoke sesi, lalu autentikasi ulang untuk memperoleh sesi baru.
2. Amati request dari browser yang sudah login melalui DevTools Network; jangan menaruh cookies, token, API key, atau header Authorization ke file proyek, terminal yang direkam, issue, atau chat.
3. Catat hanya metadata yang sudah disamarkan: status HTTP, content-type, ukuran respons, dan apakah body kosong/JSON/protobuf.
4. Jangan menganggap respons sukses sebagai bukti saldo Gemini. Verifikasi pemakaian video melalui riwayat chat Gemini yang terpisah.
5. Hapus atau samarkan kredensial dari log/artefak lokal sebelum membagikan hasil.

Belum ada request jaringan atau tes endpoint yang dijalankan dari folder ini.

## Scan jumlah video dari percakapan Gemini

`scan-chat-videos-console.js` menjalankan pemindaian diagnostik langsung dari Console browser pada sesi Gemini yang sedang login. Script membaca daftar hingga 100 percakapan dan riwayatnya, menghitung aset video yang terdeteksi, serta menampilkan jumlah per chat. Script tidak mencetak prompt atau URL video.

Cara pakai:

1. Login ke akun yang ingin diperiksa di `https://gemini.google.com`.
2. Buka DevTools → Console, lalu paste isi `scan-chat-videos-console.js`.
3. Tunggu hingga tabel hasil dan status kelengkapan muncul.
4. Hasil tersedia di `window.__ambGeminiChatVideoScan`.

Hasil adalah perkiraan berdasarkan aset video yang terbaca pada riwayat percakapan, bukan saldo/kuota resmi. Pemindaian dibatasi 100 percakapan; jika batas tercapai atau ada riwayat gagal dibaca, hasil ditandai belum lengkap. Jangan membagikan cookie, token, prompt, atau data akun dari DevTools.
