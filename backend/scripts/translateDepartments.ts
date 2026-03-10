console.log('🚀 Translation script started...');

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });
console.log('📄 Environment variables loaded from:', path.join(__dirname, '../.env'));

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://agadge797_db_user:Amg797gmail@cluster0.5sim50l.mongodb.net/test';

// Define Department Schema (simplified for this script)
const DepartmentSchema = new mongoose.Schema({
  name: String,
  nameHi: String,
  nameMr: String,
  nameOr: String,
});

const Department = mongoose.model('Department', DepartmentSchema);

const TRANSLATIONS: Record<string, { hi: string; mr: string; or: string }> = {
  "Revenue & Disaster Management": {
    hi: "राजस्व एवं आपदा प्रबंधन",
    mr: "महसूल आणि आपत्ती व्यवस्थापन",
    or: "ରାଜସ୍ୱ ଏବଂ ବିପର୍ଯ୍ୟୟ ପରିଚାଳନା"
  },
  "Tahasil Office, Jharsuguda": {
    hi: "तहसील कार्यालय, झारसुगुड़ा",
    mr: "तहसील कार्यालय, झारसुगुडा",
    or: "ତହସିଲ କାର୍ଯ୍ୟାଳୟ, ଝାରସୁଗୁଡା"
  },
  "Tahasil Office,Lakhanpur": {
    hi: "तहसील कार्यालय, लखनपुर",
    mr: "तहसील कार्यालय, लखनपूर",
    or: "ତହସିଲ କାର୍ଯ୍ୟାଳୟ, ଲଖନପୁର"
  },
  "Tahasil Office,Kolabira": {
    hi: "तहसील कार्यालय, कोलाबिरा",
    mr: "तहसील कार्यालय, कोलाबिरा",
    or: "ତହସିଲ କାର୍ଯ୍ୟାଳୟ, କୋଲାବିରା"
  },
  "Tahasil Office,Kirmira": {
    hi: "तहसील कार्यालय, किरमिरा",
    mr: "तहसील कार्यालय, किरमिरा",
    or: "ତହସିଲ କାର୍ଯ୍ୟାଳୟ, କିର୍ମିରା"
  },
  "Tahasil Office,Laikera": {
    hi: "तहसील कार्यालय, लाइकेरा",
    mr: "तहसील कार्यालय, लायकेरा",
    or: "ତହସିଲ କାର୍ଯ୍ୟାଳୟ, ଲାଇକେରା"
  },
  "District Sub-Registrar Office Jharsuguda": {
    hi: "जिला उप-निबंधक कार्यालय झारसुगुड़ा",
    mr: "जिल्हा उप-निबंधक कार्यालय झारसुगुडा",
    or: "ଜିଲ୍ଲା ଉପ-ନିବନ୍ଧକ କାର୍ଯ୍ୟାଳୟ ଝାରସୁଗୁଡା"
  },
  "Sub-Registrar Office Lakhanpur": {
    hi: "उप-निबंधक कार्यालय लखनपुर",
    mr: "उप-निबंधक कार्यालय लखनपूर",
    or: "ଉପ-ନିବନ୍ଧକ କାର୍ଯ୍ୟାଳୟ ଲଖନପୁର"
  },
  "Land Acquisition Office": {
    hi: "भूमि अधिग्रहण कार्यालय",
    mr: "भूसंपादन कार्यालय",
    or: "ଭୂ-ଅଧିଗ୍ରହଣ କାର୍ଯ୍ୟାଳୟ"
  },
  "Special Land Acquisition Office": {
    hi: "विशेष भूमि अधिग्रहण कार्यालय",
    mr: "विशेष भूसंपादन कार्यालय",
    or: "ସ୍ୱତନ୍ତ୍ର ଭୂ-ଅଧିଗ୍ରହଣ କାର୍ଯ୍ୟାଳୟ"
  },
  "Panchayatiraj & Drinking Water": {
    hi: "पंचायती राज एवं पेयजल",
    mr: "पंचायत राज आणि पिण्याचे पाणी",
    or: "ପଞ୍ଚାୟତରାଜ ଏବଂ ପାନୀୟ ଜଳ"
  },
  "Block Development Office,Jharsuguda": {
    hi: "ब्लॉक विकास कार्यालय, झारसुगुड़ा",
    mr: "गट विकास कार्यालय, झारसुगुडा",
    or: "ବ୍ଲକ ଉନ୍ନୟନ କାର୍ଯ୍ୟାଳୟ, ଝାରସୁଗୁଡା"
  },
  "Block Development Office,Lakhanpur": {
    hi: "ब्लॉक विकास कार्यालय, लखनपुर",
    mr: "गट विकास कार्यालय, लखनपूर",
    or: "ବ୍ଲକ ଉନ୍ନୟନ କାର୍ଯ୍ୟାଳୟ, ଲଖନପୁର"
  },
  "Block Development Office,Kolabira": {
    hi: "ब्लॉक विकास कार्यालय, कोलाबिरा",
    mr: "गट विकास कार्यालय, कोलाबिरा",
    or: "ବ୍ଲକ ଉନ୍ନୟନ କାର୍ଯ୍ୟାଳୟ, କୋଲାବିରା"
  },
  "Block Development Office,Laikera": {
    hi: "ब्लॉक विकास कार्यालय, लाइकेरा",
    mr: "गट विकास कार्यालय, लायकेरा",
    or: "ବ୍ଲକ ଉନ୍ନୟନ କାର୍ଯ୍ୟାଳୟ, ଲାଇକେରା"
  },
  "Block Development Office,Kirmira": {
    hi: "ब्लॉक विकास कार्यालय, किरमिरा",
    mr: "गट विकास कार्यालय, किरमिरा",
    or: "ବ୍ଲକ ଉନ୍ନୟନ କାର୍ଯ୍ୟାଳୟ, କିର୍ମିରା"
  },
  "District Panchayat Office,Jharsuguda": {
    hi: "जिला पंचायत कार्यालय, झारसुगुड़ा",
    mr: "जिल्हा पंचायत कार्यालय, झारसुगुडा",
    or: "ଜିଲ୍ଲା ପଞ୍ଚାୟତ କାର୍ଯ୍ୟାଳୟ, ଝାରସୁଗୁଡା"
  },
  "RWS&S Office,Jharsuguda": {
    hi: "आरडब्ल्यूएस एंड एस कार्यालय, झारसुगुड़ा",
    mr: "आरडब्ल्यूएस आणि एस कार्यालय, झारसुगुडा",
    or: "ଆର.ଡବ୍ଲୁ.ଏସ. ଏସ କାର୍ଯ୍ୟାଳୟ, ଝାରସୁଗୁଡା"
  },
  "ORMAS Office,Jharsuguda": {
    hi: "ओरमास कार्यालय, झारसुगुड़ा",
    mr: "ओरमास कार्यालय, झारसुगुडा",
    or: "ଓରମାସ୍ କାର୍ଯ୍ୟାଳୟ, ଝାରସୁଗୁଡା"
  },
  "Agriculture and Farmers Empowerment": {
    hi: "कृषि एवं किसान सशक्तिकरण",
    mr: "कृषी आणि शेतकरी सक्षमीकरण",
    or: "କୃଷି ଏବଂ କୃଷକ ସଶକ୍ତିକରଣ"
  },
  "Chief District Agricuture Office,Jharsuguda": {
    hi: "मुख्य जिला कृषि कार्यालय, झारसुगुड़ा",
    mr: "मुख्य जिल्हा कृषी कार्यालय, झारसुगुडा",
    or: "ମୁଖ୍ୟ ଜିଲ୍ଲା କୃଷି କାର୍ଯ୍ୟାଳୟ, ଝାରସୁଗୁଡା"
  },
  "Co-Operation": {
    hi: "सहकारिता",
    mr: "सहकार",
    or: "ସମବାୟ"
  },
  "Dy.Registrar of Co-Operative Society Office,Jharsuguda": {
    hi: "उप-निबंधक सहकारी समिति कार्यालय, झारसुगुड़ा",
    mr: "उपनिबंधक सहकारी संस्था कार्यालय, झारसुगुडा",
    or: "ଉପ-ନିବନ୍ଧକ ସମବାୟ ସମିତି କାର୍ଯ୍ୟାଳୟ, ଝାରସୁଗୁଡା"
  },
  "Commece and Transport": {
    hi: "वाणिज्य एवं परिवहन",
    mr: "वाणिज्य आणि परिवहन",
    or: "ବାଣିଜ୍ୟ ଏବଂ ପରିବହନ"
  },
  "Regional Transport Office": {
    hi: "क्षेत्रीय परिवहन कार्यालय",
    mr: "प्रादेशिक परिवहन कार्यालय",
    or: "ଆଞ୍ଚଳିକ ପରିବହନ କାର୍ଯ୍ୟାଳୟ"
  },
  "Energy": {
    hi: "ऊर्जा",
    mr: "ऊर्जा",
    or: "ଶକ୍ତି"
  },
  "TPWODL Jharsuguda Office": {
    hi: "टीपीडब्ल्यूओडीएल झारसुगुड़ा कार्यालय",
    mr: "टीपीडब्ल्यूओडीएल झारसुगुडा कार्यालय",
    or: "ଟି.ପି.ଡବ୍ଲୁ.ଓ.ଡି.ଏଲ ଝାରସୁଗୁଡା କାର୍ଯ୍ୟାଳୟ"
  },
  "TPWODL Brajrajnagar Office": {
    hi: "टीपीडब्ल्यूओडीएल ब्रजराजनगर कार्यालय",
    mr: "टीपीडब्ल्यूओडीएल ब्रजराजनगर कार्यालय",
    or: "ଟି.ପି.ଡବ୍ଲୁ.ଓ.ଡି.ଏଲ ବ୍ରଜରାଜନଗର କାର୍ଯ୍ୟାଳୟ"
  },
  "Excise": {
    hi: "उत्पाद शुल्क",
    mr: "उत्पादन शुल्क",
    or: "ଅବକାରୀ"
  },
  "Excise Office,Jharsuguda": {
    hi: "उत्पाद शुल्क कार्यालय, झारसुगुड़ा",
    mr: "उत्पादन शुल्क कार्यालय, झारसुगुडा",
    or: "ଅବକାରୀ କାର୍ଯ୍ୟାଳୟ, ଝାରସୁଗୁଡା"
  },
  "Finance": {
    hi: "वित्त",
    mr: "वित्त",
    or: "ଅର୍ଥ"
  },
  "District Treasury Office,Jharsuguda": {
    hi: "जिला खजाना कार्यालय, झारसुगुड़ा",
    mr: "जिल्हा कोषागार कार्यालय, झारसुगुडा",
    or: "ଜିଲ୍ଲା କୋଷାଗାର କାର୍ଯ୍ୟାଳୟ, ଝାରସୁଗୁଡା"
  },
  "Fisheries & Animal Resource Development": {
    hi: "मत्स्य पालन एवं पशु संसाधन विकास",
    mr: "मत्स्यपालन आणि पशु संसाधन विकास",
    or: "ମତ୍ସ୍ୟ ଏବଂ ପ୍ରାଣୀ ସମ୍ପଦ ବିକାଶ"
  },
  "District Fisheries Office,Jharsuguda": {
    hi: "जिला मत्स्य कार्यालय, झारसुगुड़ा",
    mr: "जिल्हा मत्स्यपालन कार्यालय, झारसुगुडा",
    or: "ଜିଲ୍ଲା ମତ୍ସ୍ୟ କାର୍ଯ୍ୟାଳୟ, ଝାରସୁଗୁଡା"
  },
  "Chief District Veterinary Office,Jharsuguda": {
    hi: "मुख्य जिला पशु चिकित्सा कार्यालय, झारसुगुड़ा",
    mr: "मुख्य जिल्हा पशुवैद्यकीय कार्यालय, झारसुगुडा",
    or: "ମୁଖ୍ୟ ଜିଲ୍ଲା ପ୍ରାଣୀ ଚିକିତ୍ସା କାର୍ଯ୍ୟାଳୟ, ଝାରସୁଗୁଡା"
  },
  "Food Supplies & Consumer Welfare": {
    hi: "खाद्य आपूर्ति एवं उपभोक्ता कल्याण",
    mr: "अन्न पुरवठा आणि ग्राहक कल्याण",
    or: "ଖାଦ୍ୟ ଯୋଗାଣ ଏବଂ ଖାଉଟି କଲ୍ୟାଣ"
  },
  "Civil Supply office,Jharsuguda": {
    hi: "नागरिक आपूर्ति कार्यालय, झारसुगुड़ा",
    mr: "नागरी पुरवठा कार्यालय, झारसुगुडा",
    or: "ଯୋଗାଣ କାର୍ଯ୍ୟାଳୟ, ଝାରସୁଗୁଡା"
  },
  "Forest & Environment": {
    hi: "वन एवं पर्यावरण",
    mr: "वन आणि पर्यावरण",
    or: "ଜଙ୍ଗଲ ଏବଂ ପରିବେଶ"
  },
  "Jharsuguda Forest Range": {
    hi: "झारसुगुड़ा वन रेंज",
    mr: "झारसुगुडा वन क्षेत्र",
    or: "ଝାରସୁଗୁଡା ଜଙ୍ଗଲ ରେଞ୍ଜ"
  },
  "Bagdihi Forest Range": {
    hi: "बागडीही वन रेंज",
    mr: "बागडीही वन क्षेत्र",
    or: "ବାଗଡିହି ଜଙ୍ଗଲ ରେଞ୍ଜ"
  },
  "Kolabira Forest Range": {
    hi: "कोलाबिरा वन रेंज",
    mr: "कोलाबिरा वन क्षेत्र",
    or: "କୋଲାବିରା ଜଙ୍ଗଲ ରେଞ୍ଜ"
  },
  "Belpahar Forest Range": {
    hi: "बेलपहाड़ वन रेंज",
    mr: "बेलपहार वन क्षेत्र",
    or: "ବେଲପାହାଡ ଜଙ୍ଗଲ ରେଞ୍ଜ"
  },
  "Brajrajnagar Forest Range": {
    hi: "ब्रजराजनगर वन रेंज",
    mr: "ब्रजराजनगर वन क्षेत्र",
    or: "ବ୍ରଜରାଜନଗର ଜଙ୍ଗଲ ରେଞ୍ଜ"
  },
  "Jharsuguda Regional Office,State Pollution Control Board": {
    hi: "झारसुगुड़ा क्षेत्रीय कार्यालय, राज्य प्रदूषण नियंत्रण बोर्ड",
    mr: "झारसुगुडा प्रादेशिक कार्यालय, राज्य प्रदूषण नियंत्रण मंडळ",
    or: "ଝାରସୁଗୁଡା ଆଞ୍ଚଳିକ କାର୍ଯ୍ୟାଳୟ, ରାଜ୍ୟ ପ୍ରଦୂଷଣ ନିୟନ୍ତ୍ରଣ ବୋର୍ଡ"
  },
  "Health & Family Welfare": {
    hi: "स्वास्थ्य एवं परिवार कल्याण",
    mr: "आरोग्य आणि कुटुंब कल्याण",
    or: "ସ୍ୱାସ୍ଥ୍ୟ ଏବଂ ପରିବାର କଲ୍ୟାଣ"
  },
  "PHC Arda": {
    hi: "पीएचसी अरदा",
    mr: "प्राथमिक आरोग्य केंद्र अरडा",
    or: "ପ୍ରାଥମିକ ସ୍ୱାସ୍ଥ୍ୟ କେନ୍ଦ୍ର ଅର୍ଦ୍ଧା"
  },
  "PHC Bagdihi": {
    hi: "पीएचसी बागडीही",
    mr: "प्राथमिक आरोग्य केंद्र बागडीही",
    or: "ପ୍ରାଥମିକ ସ୍ୱାସ୍ଥ୍ୟ କେନ୍ଦ୍ର ବାଗଡିହି"
  },
  "CHC Kirmira": {
    hi: "सीएचसी किरमिरा",
    mr: "समुदाय आरोग्य केंद्र किरमिरा",
    or: "ଗୋଷ୍ଠୀ ସ୍ୱାସ୍ଥ୍ୟ କେନ୍ଦ୍ର କିର୍ମିରା"
  },
  "PHC Pakelpada": {
    hi: "पीएचसी पाकेलपाड़ा",
    mr: "प्राथमिक आरोग्य केंद्र पाकेलपाडा",
    or: "ପ୍ରାଥମିକ ସ୍ୱାସ୍ଥ୍ୟ କେନ୍ଦ୍ର ପାକେଲପଡା"
  },
  "PHC Sahaspur": {
    hi: "पीएचसी साहसपुर",
    mr: "प्राथमिक आरोग्य केंद्र सहसपूर",
    or: "ପ୍ରାଥମିକ ସ୍ୱାସ୍ଥ୍ୟ କେନ୍ଦ୍ର ସାହାସପୁର"
  },
  "CHC Mundrajore": {
    hi: "सीएचसी मुंदराजोरे",
    mr: "समुदाय आरोग्य केंद्र मुंदराजोरे",
    or: "ଗୋଷ୍ଠୀ ସ୍ୱାସ୍ଥ୍ୟ କେନ୍ଦ୍ର ମୁଣ୍ଡ୍ରାଜୋର"
  },
  "PHC Bhadimal": {
    hi: "पीएचसी भड़ीमल",
    mr: "प्राथमिक आरोग्य केंद्र भडीमल",
    or: "ପ୍ରାଥମିକ ସ୍ୱାସ୍ଥ୍ୟ କେନ୍ଦ୍ର ଭାଦିମାଲ"
  },
  "PHC Pokharasal": {
    hi: "पीएचसी पोखरसाल",
    mr: "प्राथमिक आरोग्य केंद्र पोखरसाल",
    or: "ପ୍ରାଥମିକ ସ୍ୱାସ୍ଥ୍ୟ କେନ୍ଦ୍ର ପୋଖରାସାଲ"
  },
  "CHC Kolabira": {
    hi: "सीएचसी कोलाबिरा",
    mr: "समुदाय आरोग्य केंद्र कोलाबिरा",
    or: "ଗୋଷ୍ଠୀ ସ୍ୱାସ୍ଥ୍ୟ କେନ୍ଦ୍ର କୋଲାବିରା"
  },
  "CHC Lakhanpur": {
    hi: "सीएचसी लखनपुर",
    mr: "समुदाय आरोग्य केंद्र लखनपूर",
    or: "ଗୋଷ୍ଠୀ ସ୍ୱାସ୍ଥ୍ୟ କେନ୍ଦ୍ର ଲଖନପୁର"
  },
  "PHC Kanaktora": {
    hi: "पीएचसी कनकतोरा",
    mr: "प्राथमिक आरोग्य केंद्र कनकतोरा",
    or: "ପ୍ରାଥମିକ ସ୍ୱାସ୍ଥ୍ୟ କେନ୍ଦ୍ର କନକତୋରା"
  },
  "PHC Palsada": {
    hi: "पीएचसी पलसाड़ा",
    mr: "प्राथमिक आरोग्य केंद्र पलसाडा",
    or: "ପ୍ରାଥମିକ ସ୍ୱାସ୍ଥ୍ୟ କେନ୍ଦ୍ର ପଲସଦା"
  },
  "PHC Remta": {
    hi: "पीएचसी रेमटा",
    mr: "प्राथमिक आरोग्य केंद्र रेमटा",
    or: "ପ୍ରାଥମିକ ସ୍ୱାସ୍ଥ୍ୟ କେନ୍ଦ୍ର ରେମଟା"
  },
  "PHC Adhapada": {
    hi: "पीएचसी आधापाड़ा",
    mr: "प्राथमिक आरोग्य केंद्र आधापाडा",
    or: "ପ୍ରାଥମିକ ସ୍ୱାସ୍ଥ୍ୟ କେନ୍ଦ୍ର ଅଢାପଡା"
  },
  "PHC Kumarbandha": {
    hi: "पीएचसी कुमारबंधा",
    mr: "प्राथमिक आरोग्य केंद्र कुमारबंधा",
    or: "ପ୍ରାଥମିକ ସ୍ୱାସ୍ଥ୍ୟ କେନ୍ଦ୍ର କୁମାରବନ୍ଧ"
  },
  "UPHC Belpahar": {
    hi: "यूपीएचसी बेलपहाड़",
    mr: "नागरी प्राथमिक आरोग्य केंद्र बेलपहार",
    or: "ସହରୀ ପ୍ରାଥମିକ ସ୍ୱାସ୍ଥ୍ୟ କେନ୍ଦ୍ର ବେଲପାହାଡ"
  },
  "PHC Sripura": {
    hi: "पीएचसी श्रीपुरा",
    mr: "प्राथमिक आरोग्य केंद्र श्रीपुरा",
    or: "ପ୍ରାଥମିକ ସ୍ୱାସ୍ଥ୍ୟ କେନ୍ଦ୍ର ଶ୍ରୀପୁରା"
  },
  "PHC Loisingh": {
    hi: "पीएचसी लोइसिंग",
    mr: "प्राथमिक आरोग्य केंद्र लोइसिंग",
    or: "ପ୍ରାଥମିକ ସ୍ୱାସ୍ଥ୍ୟ କେନ୍ଦ୍ର ଲୋଇସିଙ୍ହ"
  },
  "CHC Rajpur": {
    hi: "सीएचसी राजपुर",
    mr: "समुदाय आरोग्य केंद्र राजपूर",
    or: "ଗୋଷ୍ଠୀ ସ୍ୱାସ୍ଥ୍ୟ କେନ୍ଦ୍ର ରାଜପୁର"
  },
  "UPHC Kukrikani": {
    hi: "यूपीएचसी कुकरीकानी",
    mr: "नागरी प्राथमिक आरोग्य केंद्र कुकरीकानी",
    or: "ସହରୀ ପ୍ରାଥମିକ ସ୍ୱାସ୍ଥ୍ୟ କେନ୍ଦ୍ର କୁକ୍ରିକାନି"
  },
  "CHC Brajrajnagar": {
    hi: "सीएचसी ब्रजराजनगर",
    mr: "समुदाय आरोग्य केंद्र ब्रजराजनगर",
    or: "ଗୋଷ୍ଠୀ ସ୍ୱାସ୍ଥ୍ୟ କେନ୍ଦ୍ର ବ୍ରଜରାଜନଗର"
  },
  "PHC Talpatia": {
    hi: "पीएचसी तालपतिया",
    mr: "प्राथमिक आरोग्य केंद्र तलपटिया",
    or: "ପ୍ରାଥମିକ ସ୍ୱାସ୍ଥ୍ୟ କେନ୍ଦ୍ର ତାଲପତିଆ"
  },
  "UPHC Jharsuguda": {
    hi: "यूपीएचसी झारसुगुड़ा",
    mr: "नागरी प्राथमिक आरोग्य केंद्र झारसुगुडा",
    or: "ସହରୀ ପ୍ରାଥମିକ ସ୍ୱାସ୍ଥ୍ୟ କେନ୍ଦ୍ର ଝାରସୁଗୁଡା"
  },
  "UPHC Panchapoda": {
    hi: "यूपीएचसी पंचपोड़ा",
    mr: "नागरी प्राथमिक आरोग्य केंद्र पंचपोडा",
    or: "ସହରୀ ପ୍ରାଥମିକ ସ୍ୱାସ୍ଥ୍ୟ କେନ୍ଦ୍ର ପଞ୍ଚପଡା"
  },
  "Home": {
    hi: "गृह विभाग",
    mr: "गृह विभाग",
    or: "ଗୃହ ବିଭାଗ"
  },
  "Sub-Divisional Police Office,Jharsuguda": {
    hi: "अनुमंडल पुलिस कार्यालय, झारसुगुड़ा",
    mr: "उपविभागीय पोलीस कार्यालय, झारसुगुडा",
    or: "ଉପ-ଖଣ୍ଡ ପୋଲିସ୍ କାର୍ଯ୍ୟାଳୟ, ଝାରସୁଗୁଡା"
  },
  "Sub-Divisional Police Office,Brajrajnagar": {
    hi: "अनुमंडल पुलिस कार्यालय, ब्रजराजनगर",
    mr: "उपविभागीय पोलीस कार्यालय, ब्रजराजनगर",
    or: "ଉପ-ଖଣ୍ଡ ପୋଲିସ୍ କାର୍ଯ୍ୟାଳୟ, ବ୍ରଜରାଜନଗର"
  },
  "Jharsuguda Town P.S": {
    hi: "झारसुगुड़ा टाउन पुलिस स्टेशन",
    mr: "झारसुगुडा शहर पोलीस स्टेशन",
    or: "ଝାରସୁଗୁଡା ଟାଉନ୍ ପୋଲିସ୍ ଷ୍ଟେସନ୍"
  },
  "Jharsuguda Sadar P.S": {
    hi: "झारसुगुड़ा सदर पुलिस स्टेशन",
    mr: "झारसुगुडा सदर पोलीस स्टेशन",
    or: "ଝାରସୁଗୁଡା ସଦର ପୋଲିସ୍ ଷ୍ଟେସନ୍"
  },
  "Jharsuguda Airport P.S": {
    hi: "झारसुगुड़ा एयरपोर्ट पुलिस स्टेशन",
    mr: "झारसुगुडा विमानतळ पोलीस स्टेशन",
    or: "ଝାରସୁଗୁଡା ଏୟାରପୋର୍ଟ ପୋଲିସ୍ ଷ୍ଟେସନ୍"
  },
  "Brajrajnagar P.S.": {
    hi: "ब्रजराजनगर पुलिस स्टेशन",
    mr: "ब्रजराजनगर पोलीस स्टेशन",
    or: "ବ୍ରଜରାଜନଗର ପୋଲିସ୍ ଷ୍ଟେସନ୍"
  },
  "Orient P.S": {
    hi: "ओरिएंट पुलिस स्टेशन",
    mr: "ओरिएंट पोलीस स्टेशन",
    or: "ଓରିଏଣ୍ଟ ପୋଲିସ୍ ଷ୍ଟେସନ୍"
  },
  "Laikera PS": {
    hi: "लाइकेरा पुलिस स्टेशन",
    mr: "लायकेरा पोलीस स्टेशन",
    or: "ଲାଇକେରା ପୋଲିସ୍ ଷ୍ଟେସନ୍"
  },
  "Kolabira P.S": {
    hi: "कोलाबिरा पुलिस स्टेशन",
    mr: "कोलाबिरा पोलीस स्टेशन",
    or: "କୋଲାବିରା ପୋଲିସ୍ ଷ୍ଟେସନ୍"
  },
  "lakhanpur P.S.": {
    hi: "लखनपुर पुलिस स्टेशन",
    mr: "लखनपूर पोलीस स्टेशन",
    or: "ଲଖନପୁର ପୋଲିସ୍ ଷ୍ଟେସନ୍"
  },
  "banharpali P.S": {
    hi: "बनहरपाली पुलिस स्टेशन",
    mr: "बनहरपाली पोलीस स्टेशन",
    or: "ବନହରପାଲି ପୋଲିସ୍ ଷ୍ଟେସନ୍"
  },
  "Rengali P.S": {
    hi: "रेंगाली पुलिस स्टेशन",
    mr: "रेंगाली पोलीस स्टेशन",
    or: "ରେଙ୍ଗାଲି ପୋଲିସ୍ ଷ୍ଟେସନ୍"
  },
  "Housig & Urban Development": {
    hi: "आवास एवं शहरी विकास",
    mr: "गृहनिर्माण आणि नगर विकास",
    or: "ଆବାସ ଏବଂ ନଗର ଉନ୍ନୟନ"
  },
  "Municipality Office Jharsuguda": {
    hi: "नगरपालिका कार्यालय झारसुगुड़ा",
    mr: "नगरपालिका कार्यालय झारसुगुडा",
    or: "ପୌର କାର୍ଯ୍ୟାଳୟ ଝାରସୁଗୁଡା"
  },
  "Municipality Office Brajrajnagar": {
    hi: "नगरपालिका कार्यालय ब्रजराजनगर",
    mr: "नगरपालिका कार्यालय ब्रजराजनगर",
    or: "ପୌର କାର୍ଯ୍ୟାଳୟ ବ୍ରଜରାଜନଗର"
  },
  "Belpahar Municipality Officer": {
    hi: "बेलपहाड़ नगरपालिका कार्यालय",
    mr: "बेलपहार नगरपालिका कार्यालय",
    or: "ବେଲପାହାଡ ପୌର କାର୍ଯ୍ୟାଳୟ"
  },
  "Jharsuguda WATCO Division": {
    hi: "झारसुगुड़ा वाटको डिवीजन",
    mr: "झारसुगुडा वाटको विभाग",
    or: "ଝାରସୁଗୁଡା ୱାଟକୋ ଡିଭିଜନ"
  },
  "Information & Public Relation": {
    hi: "सूचना एवं जनसंपर्क",
    mr: "माहिती आणि जनसंपर्क",
    or: "ସୂଚନା ଏବଂ ଲୋକ ସମ୍ପର୍କ"
  },
  "District Information and Public Relations Office,Jharsuguda": {
    hi: "जिला सूचना और जनसंपर्क कार्यालय, झारसुगुड़ा",
    mr: "जिल्हा माहिती आणि जनसंपर्क कार्यालय, झारसुगुडा",
    or: "ଜିଲ୍ଲା ସୂଚନା ଏବଂ ଲୋକ ସମ୍ପର୍କ କାର୍ଯ୍ୟାଳୟ, ଝାରସୁଗୁଡା"
  },
  "Labour & Employee State Insurance": {
    hi: "श्रम एवं कर्मचारी राज्य बीमा",
    mr: "कामगार आणि कर्मचारी राज्य विमा",
    or: "ଶ୍ରମ ଏବଂ କର୍ମଚାରୀ ରାଜ୍ୟ ବୀମା"
  },
  "District Labour Office,Jharsuguda": {
    hi: "जिला श्रम कार्यालय, झारसुगुड़ा",
    mr: "जिल्हा कामगार कार्यालय, झारसुगुडा",
    or: "ଜିଲ୍ଲା ଶ୍ରମ କାର୍ଯ୍ୟାଳୟ, ଝାରସୁଗୁଡା"
  },
  "Micro, Small & Medium Enterprise": {
    hi: "सूक्ष्म, लघु एवं मध्यम उद्यम",
    mr: "सूक्ष्म, लघू आणि मध्यम उद्योग",
    or: "ସୂକ୍ଷ୍ମ, କ୍ଷୁଦ୍ର ଏବଂ ମଧ୍ୟମ ଉଦ୍ୟୋଗ"
  },
  "District Industries Center Office,Jharsuguda": {
    hi: "जिला उद्योग केंद्र कार्यालय, झारसुगुड़ा",
    mr: "जिल्हा उद्योग केंद्र कार्यालय, झारसुगुडा",
    or: "ଜିଲ୍ଲା ଶିଳ୍ପ କେନ୍ଦ୍ର କାର୍ଯ୍ୟାଳୟ, ଝାରସୁଗୁଡା"
  },
  "Odia Language, Literature & Culture": {
    hi: "ओडिया भाषा, साहित्य एवं संस्कृति",
    mr: "ओडिया भाषा, साहित्य आणि संस्कृती",
    or: "ଓଡିଆ ଭାଷା, ସାହିତ୍ୟ ଏବଂ ସଂସ୍କୃତି"
  },
  "District Culture Office,Jharsuguda": {
    hi: "जिला संस्कृति कार्यालय, झारसुगुड़ा",
    mr: "जिल्हा संस्कृती कार्यालय, झारसुगुडा",
    or: "ଜିଲ୍ଲା ସଂସ୍କୃତି କାର୍ଯ୍ୟାଳୟ, ଝାରସୁଗୁଡା"
  },
  "Planning & Convergance": {
    hi: "योजना एवं अभिसरण",
    mr: "नियोजन आणि अभिसरण",
    or: "ଯୋଜନା ଏବଂ ଅଭିସରଣ"
  },
  "District Planning and Monitoring Unit": {
    hi: "जिला योजना और निगरानी इकाई",
    mr: "जिल्हा नियोजन आणि नियंत्रण कक्ष",
    or: "ଜିଲ୍ଲା ଯୋଜନା ଏବଂ ଅନୁଧ୍ୟାନ ୟୁନିଟ୍"
  },
  "Rural Development": {
    hi: "ग्रामीण विकास",
    mr: "ग्रामीण विकास",
    or: "ଗ୍ରାମ୍ୟ ଉନ୍ନୟନ"
  },
  "Rural Development Office,Jharsuguda": {
    hi: "ग्रामीण विकास कार्यालय, झारसुगुड़ा",
    mr: "ग्रामीण विकास कार्यालय, झारसुगुडा",
    or: "ଗ୍ରାମ୍ୟ ଉନ୍ନୟନ କାର୍ଯ୍ୟାଳୟ, ଝାରସୁଗୁଡା"
  },
  "School & Mass Education": {
    hi: "स्कूल एवं जन शिक्षा",
    mr: "शाळा आणि शालेय शिक्षण",
    or: "ବିଦ୍ୟାଳୟ ଏବଂ ଗଣ ଶିକ୍ଷା"
  }
};

async function run() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected.');

    const departments = await Department.find({});
    console.log(`🔍 Found ${departments.length} departments.`);

    let updatedCount = 0;
    for (const dept of departments) {
      const originalName = dept.name || '';
      if (!originalName) {
        console.warn(`⚠️ skipping department with missing name: ${dept._id}`);
        continue;
      }

      const translation = TRANSLATIONS[originalName];
      
      if (translation) {
        dept.nameHi = translation.hi;
        dept.nameMr = translation.mr;
        dept.nameOr = translation.or;
        await dept.save();
        updatedCount++;
      } else {
        // Fallback translation logic for names not in map
        let hi = dept.nameHi;
        let mr = dept.nameMr;
        let or = dept.nameOr;

        // Simple replacements for common terms if missing
        if (!hi) {
           hi = originalName
            .replace(/Tahasil Office/g, 'तहसील कार्यालय')
            .replace(/Block Development Office/g, 'ब्लॉक विकास कार्यालय')
            .replace(/District/g, 'जिला')
            .replace(/Office/g, 'कार्यालय')
            .replace(/Jharsuguda/g, 'झारसुगुड़ा')
            .replace(/P.S/g, 'पुलिस स्टेशन');
        }
        
        if (!mr) {
           mr = originalName
            .replace(/Tahasil Office/g, 'तहसील कार्यालय')
            .replace(/Block Development Office/g, 'गट विकास कार्यालय')
            .replace(/District/g, 'जिल्हा')
            .replace(/Office/g, 'कार्यालय')
            .replace(/Jharsuguda/g, 'झारसुगुडा')
            .replace(/P.S/g, 'पोलीस स्टेशन');
        }

        if (!or) {
           or = originalName
            .replace(/Tahasil Office/g, 'ତହସିଲ କାର୍ଯ୍ୟାଳୟ')
            .replace(/Block Development Office/g, 'ବ୍ଲକ ଉନ୍ନୟନ କାର୍ଯ୍ୟାଳୟ')
            .replace(/District/g, 'ଜିଲ୍ଲା')
            .replace(/Office/g, 'କାର୍ଯ୍ୟାଳୟ')
            .replace(/Jharsuguda/g, 'ଝାରସୁଗୁଡା')
            .replace(/P.S/g, 'ପୋଲିସ୍ ଷ୍ଟେସନ୍');
        }

        if (hi !== dept.nameHi || mr !== dept.nameMr || or !== dept.nameOr) {
          dept.nameHi = hi;
          dept.nameMr = mr;
          dept.nameOr = or;
          await dept.save();
          updatedCount++;
        }
      }
    }

    console.log(`✅ Successfully updated ${updatedCount} departments with translations.`);
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected.');
  }
}

run();
