const https = require('https');

const cookies = `OTZ=8809094_28_28__28_; NID=CsYCCAES-AEBOxGDSNgfviZJo-Q7h9eWKwbQiy5lyaHeHvQaXtkJeqIWAVMaaUHBl7oHT_RRUJAUjvVc0k3odRdYxNaKXPIVgh2_HOQj0EfnAEU07rIrrZsxbMJdjDLHMfEsCDHrg1YlOCAXnhRzTqqLF0We1pP1GZJTQjeh06IhzKFsQzzNaFxiyuoyEljT4IlBikbt6Pp6iHTnT7onjf1KPanNipHl1WJWGsnaB7gqS6hToSEqKKAf9Fv4A3-sOr2KSM80VnnGYoYc4LRczWGM6Jj5TPtZmoVpXzLdHyvR4dmUSlYnr_VBPYAF_2ndEhL_o5fV7jyze2VdoF0CtCgBMkUB0qwHzyjCbB-s69zGrKe6y_t4TGXM6jAAi9ttKm0viKyBuAj9J1VBVpUUCTmHUKpqL6IZ41-QqXD_AFcAJ97s39ShSgA; HSID=AF4_Mo52ZRaGl2ju4; SSID=A8IINJQh-olcglSJ0; APISID=khVocz4kmOyvtlCX/Ad8E_LsYW6Q6SRMcy; SAPISID=MpTNkJmPLwXD-4TS/AWlBjPUVJurLO9w4o; __Secure-1PAPISID=MpTNkJmPLwXD-4TS/AWlBjPUVJurLO9w4o; __Secure-3PAPISID=MpTNkJmPLwXD-4TS/AWlBjPUVJurLO9w4o; ACCOUNT_CHOOSER=AFx_qI7yeqp7iSqPFvaqMNejJE86-AtGDbiUDNOJkeoGVfibCSHYRn70GoO-Q6FOXY04YuhAn6XmKicYk_xNYB2kdL7_8qThX3D82VR7ESeQOGTb037pl69nzUujp52VfRjAZ1peBCfFTcbUUnVeBI2JDJM0FTd4DA; __Host-GAPS=1:o74PN_RvtKuwPo8w8Vf4-vGEvsYSYmZ9wt_wwrSnG4QHHk1IvDJqLa-p95xxNcZrHnYYNB_0tNBymCXXPr9NPBbrK8XRrw:8HV-OsvqRbtRnVG3; LSID=o.myaccount.google.com|s.ID|s.youtube:g.a000DAnzi69HaiYnTYyNXLnYTGMzGtgvpn8b7Q_uQmf_ppx9Hh9aLCqiEIiQb2mimkXohGKBKgACgYKARQSARASFQHGX2MiRF01pDI1VQtXaSOSHGwqSRoVAUF8yKp1jJEhncWG6e2zjufetLXo0076; __Host-1PLSID=o.myaccount.google.com|s.ID|s.youtube:g.a000DAnzi69HaiYnTYyNXLnYTGMzGtgvpn8b7Q_uQmf_ppx9Hh9atsSFg6moRsBp9VVb3YbntwACgYKAQASARASFQHGX2Mijrn8IT7KXDGNBno-zpeDSBoVAUF8yKpzJGfEp_gGqCcTPJUTxcj10076; __Host-3PLSID=o.myaccount.google.com|s.ID|s.youtube:g.a000DAnzi69HaiYnTYyNXLnYTGMzGtgvpn8b7Q_uQmf_ppx9Hh9amE7vIM8tMTBNQnLvvJL4twACgYKAWESARASFQHGX2Miusq0EbMJ5apqs2Atu9PI5RoVAUF8yKqL-EH_XBBAbSpG17o5gpSF0076; OSID=g.a000DAnzi8tSkCMUpDMmrTa65Day-90Fn5dioEuTC8S56zX8FrAMgtgxWpKoqjwF5l54uEQO9gACgYKAQISARASFQHGX2MiFrUkJQQoPgAprcdASgVHyRoVAUF8yKq18PNmo-FiaZ6gN_cMlPmQ0076; __Secure-OSID=g.a000DAnzi8tSkCMUpDMmrTa65Day-90Fn5dioEuTC8S56zX8FrAMKmMa_yRwliD93GhJpDxMcQACgYKAccSARASFQHGX2MiIeMJoq9QuHB6NYtQqL9QzxoVAUF8yKrlH-XeYRrM-ipDAjNx4TVT0076; SID=g.a000DAnzi7eENBSq9nIHAngj1xF-DwSADwwIuIfJckRzDKYMwM-zCNEeenG00T9cico5eyfUUAACgYKAbkSARASFQHGX2MiMxiHrIYzigIAgJKxrtotphoVAUF8yKp5_yX3zuSVTiI8S3FDvytY0076; __Secure-1PSID=g.a000DAnzi7eENBSq9nIHAngj1xF-DwSADwwIuIfJckRzDKYMwM-ziYCFvZoQyRQbEjq8ebrkiwACgYKAZ0SARASFQHGX2Mi_2nxmDxMl1AsxPHoFf4LhhoVAUF8yKpuKljLUk-seNd9YAnMW2jc0076; __Secure-3PSID=g.a000DAnzi7eENBSq9nIHAngj1xF-DwSADwwIuIfJckRzDKYMwM-zFwE3m6KZkh8wpacARCc10gACgYKAYMSARASFQHGX2MiCbBSFCu5aQ3VYz1A1XaIXBoVAUF8yKrj2RNh4TDQT0su9KfiyM6j0076; __Secure-1PSIDTS=sidts-CjcBkldj_4SaoOU29DtUpotsV5j9IcCwv2Ta9fLsmgDh88IDGM8-7plh_kpGHpX1aKhHjnIg5m5hEAA; __Secure-1PSIDRTS=sidts-CjcBkldj_4SaoOU29DtUpotsV5j9IcCwv2Ta9fLsmgDh88IDGM8-7plh_kpGHpX1aKhHjnIg5m5hEAA; __Secure-3PSIDTS=sidts-CjcBkldj_4SaoOU29DtUpotsV5j9IcCwv2Ta9fLsmgDh88IDGM8-7plh_kpGHpX1aKhHjnIg5m5hEAA; __Secure-3PSIDRTS=sidts-CjcBkldj_4SaoOU29DtUpotsV5j9IcCwv2Ta9fLsmgDh88IDGM8-7plh_kpGHpX1aKhHjnIg5m5hEAA; OTZ=8809094_28_28__28_; OTZ=8809094_28_28__28_; OTZ=8809094_28_28__28_; COMPASS=gemini-pd=CjwACWuJV93jFYb_b6k1ZbZc5AVi75OXfwVJx6huPFdJgLZgT-iphNSBtyIyTho-2Gurv4U86El7hPmdVFUQ54f-1QYaaAAJa4lXkpfOeUFXN7LNFw9yLm70RsPIVp5gvNigIwJcqCDgLEmlbv-pYdITjLNmQpDaLubyQKjHsBYykuZOjvS6I-ZwEAkWbLeq1jP8buRMFcx67fBbrXreNCRHgwiKAtMl468wZA26IAEwAQ; SIDCC=AKEyXzXoFkX5mJe8O2YwLFnvaBrM0DXS88X5XfKXnBKpNPP5e8oP4Tc8ONn5ZLsxx9qQArBp; __Secure-1PSIDCC=AKEyXzUXYel4WLFWp5SkqtMcLqcYvatd4X5hBKyvqlB57k9vIdRa7NQ-5ZbuowlbSbTUHOH_; __Secure-3PSIDCC=AKEyXzVQnMg43_bYoQye2udspL9yOi6ycuO5ZgOLS3smjoUkyv1qZcFn4ofzm-JaEDSeUxH4bQ; _gcl_au=1.1.688154503.1790849653`;

async function testVerify() {
  const req = https.request(
    {
      hostname: 'gemini.google.com',
      path: '/app',
      method: 'GET',
      maxHeaderSize: 1048576,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
        Cookie: cookies,
      },
    },
    (res) => {
      console.log('HTTP Status:', res.statusCode);
      console.log('Headers location:', res.headers.location);
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('Body length:', data.length);
        const snlm0eMatch = data.match(/"SNlM0e":"([^"]+)"/);
        const uS02keMatch = data.match(/"uS02ke":"([^"]+)"/);
        const emailMatch = data.match(/"([^"]+@gmail\.com|[^"]+@google\.com|[^"]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})"/);
        const nameMatch = data.match(/"displayName":"([^"]+)"/) || data.match(/"name":"([^"]+)"/);
        console.log('SNlM0e:', snlm0eMatch ? snlm0eMatch[1].slice(0, 15) : 'NOT FOUND');
        console.log('uS02ke:', uS02keMatch ? uS02keMatch[1].slice(0, 15) : 'NOT FOUND');
        console.log('Email Match:', emailMatch ? emailMatch[1] : 'NOT FOUND');
        console.log('Name Match:', nameMatch ? nameMatch[1] : 'NOT FOUND');
      });
    }
  );
  req.on('error', err => console.error('Req error:', err));
  req.end();
}

testVerify();
