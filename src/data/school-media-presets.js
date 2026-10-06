// Verified image URLs and attribution from Wikimedia Commons imageinfo / official
// school pages (2026-10-06). These are initial defaults, never a recurring scraper.
const commons = (hash, file, caption, credit, version = "4.0") => ({
  url: `https://thumb.wikimedia.org/wikipedia/commons/thumb/${hash}/${encodeURIComponent(file)}/1280px-${encodeURIComponent(file)}`,
  caption, credit, sourceUrl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file)}`,
  license: `CC BY-SA ${version}`, licenseUrl: `https://creativecommons.org/licenses/by-sa/${version}/`
});
const officialLogo = (url, name, sourceUrl) => ({ logoUrl: url, logoCredit: { credit: name, sourceUrl, license: "School identity / trademark", licenseUrl: "" } });
const school = (suffix, name, logo, campusPhotos) => ({ id: `40000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`, name, ...logo, campusPhotos });

export const schoolMediaPresets = [
  school(1, "University of the Philippines Diliman", officialLogo("https://upd.edu.ph/wp-content/themes/upd-theme-new/assets/img/upd-logo-2021.jpg", "University of the Philippines Diliman", "https://upd.edu.ph/"), [
    commons("1/1e", "Quezon_Hall,_U.P._Diliman,_Feb_2024.jpg", "Quezon Hall — UP Diliman", "Ralff Nestor Nacor"),
    commons("0/07", "Quezon_Hall_back_view.jpg", "Quezon Hall — rear view", "Juliennary", "3.0")
  ]),
  school(2, "Polytechnic University of the Philippines", officialLogo("https://www.pup.edu.ph/resources/images/logo200.png", "Polytechnic University of the Philippines", "https://www.pup.edu.ph/"), [
    commons("f/fd", "PUP_Lagoon_Facade_at_main_entrance.jpg", "Lagoon entrance — PUP Mabini campus", "Yamete1111"),
    commons("5/51", "PUP_Mabini_Campus_-_swimming_pool_(PUP,_Santa_Mesa,_Manila)(2018-03-07).jpg", "Swimming pool — PUP Mabini campus", "Patrick Roque")
  ]),
  school(3, "Pamantasan ng Lungsod ng Maynila", {
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/9/9b/Plm_logo.png",
    logoCredit: { credit: "Richard Relucio", sourceUrl: "https://commons.wikimedia.org/wiki/File:Plm_logo.png", license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/" }
  }, [
    { url: "https://upload.wikimedia.org/wikipedia/commons/3/3d/Pamantasan_ng_Lungsod_ng_Maynila.jpg", caption: "PLM campus — Intramuros", credit: "Richard Relucio", sourceUrl: "https://commons.wikimedia.org/wiki/File:Pamantasan_ng_Lungsod_ng_Maynila.jpg", license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/" },
    commons("b/b5", "PLM_campus_Intramuros_top_view_MH_(Manila;_07-19-2024).jpg", "PLM campus — aerial view", "Patrickroque01")
  ]),
  school(4, "Technological University of the Philippines", officialLogo("https://www.tup.edu.ph/assets/images/hockey/technological-university-of-the-philippines-logo.png", "Technological University of the Philippines", "https://www.tup.edu.ph/"), [
    commons("1/11", "TUP_Covered_Court.jpg", "Covered court — TUP Manila", "Speak0u7"),
    commons("a/a0", "TUP_Panorama.jpg", "TUP Manila campus panorama (2013)", "Rafmigz29 (uploader; author not specified)", "3.0")
  ]),
  school(5, "University of Santo Tomas", officialLogo("https://www.ust.edu.ph/wp-content/uploads/2019/07/logoustb.png", "University of Santo Tomas", "https://www.ust.edu.ph/"), [
    commons("e/ef", "University_of_Santo_Tomas_Main_Building.JPG", "UST Main Building", "Gerrard Patricio", "3.0"),
    commons("4/44", "University_of_Santo_Tomas_Main_Building_courtyard_(España_Boulevard,_Sampaloc,_Manila;_12-18-2023).jpg", "UST Main Building courtyard", "Patrickroque01")
  ]),
  school(6, "De La Salle University", officialLogo("https://www.dlsu.edu.ph/wp-content/uploads/2025/02/logo.png", "De La Salle University", "https://www.dlsu.edu.ph/"), [
    { ...commons("6/68", "DLSU_Ampitheater.jpg", "DLSU campus amphitheater", "Mithril Cloud", "2.5"), license: "CC BY 2.5", licenseUrl: "https://creativecommons.org/licenses/by/2.5/" },
    { ...commons("6/69", "DLSU_Football_Field.jpg", "DLSU football field", "Mithril Cloud", "2.5"), license: "CC BY 2.5", licenseUrl: "https://creativecommons.org/licenses/by/2.5/" }
  ]),
  school(7, "Ateneo de Manila University", officialLogo("https://thumb.wikimedia.org/wikipedia/en/thumb/6/6c/Ateneo_de_Manila_University_seal.svg/250px-Ateneo_de_Manila_University_seal.svg.png", "Ateneo de Manila University", "https://en.wikipedia.org/wiki/File:Ateneo_de_Manila_University_seal.svg"), [
    commons("2/26", "Ateneo_campus_academic_buildings_(Katipunan,_Quezon_City;_05-13-2022).jpg", "Academic buildings — Ateneo Loyola Heights", "Patrickroque01"),
    { ...commons("3/32", "Ateneo_de_Manila_University_bird's_eye_view_(Loyola_Heights)_26Oct2025_02.jpg", "Ateneo Loyola Heights campus — aerial view", "RFNirmala"), license: "CC0", licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/" }
  ]),
  school(8, "Mapua University", {
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/e7/Map%C3%BAa_University_logo_red_text.png",
    logoCredit: { credit: "Mapúa University", sourceUrl: "https://commons.wikimedia.org/wiki/File:Map%C3%BAa_University_logo_red_text.png", license: "Public domain / trademark", licenseUrl: "" }
  }, [
    commons("5/56", "Mapua_(Intramuros,_Manila)(2018-02-07)_(cropped).jpg", "Mapúa Intramuros campus", "Patrick Roque"),
    commons("1/10", "Inside_Mapua1.jpg", "Inside the Mapúa Intramuros campus", "Rafael Yrjosmiel Legaspi")
  ]),
  // STI blocks embedding its official campus images; the team will add permitted
  // photos through Admin. Migration 015 replaces the historical defaults in 014.
  school(9, "STI College Global City", officialLogo("https://thumb.wikimedia.org/wikipedia/en/thumb/1/1f/Systems_Technology_Institute.png/250px-Systems_Technology_Institute.png", "STI Education Services Group", "https://en.wikipedia.org/wiki/File:Systems_Technology_Institute.png"), [])
];
