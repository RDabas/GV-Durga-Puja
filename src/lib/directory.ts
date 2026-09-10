import type { Block, House, Owner } from "@/lib/types";

/**
 * The real society directory, transcribed from the committee's resident list.
 *
 * Flat numbers are <floor><unit>, and the unit codes differ per block —
 * A block runs 11-14, B block runs 15-18 — so each block carries its own
 * layout rather than sharing one formula. Floor counts differ too.
 *
 * Flats with no names yet are still generated so collectors can see what is
 * missing. A name ending in "…" was cut off in the source list and needs
 * completing. OWNER FAMILY / TENANT FAMILY rows are deliberately not imported.
 */

interface FlatSeed {
  flat: string;
  owner?: string[];
  tenants?: string[];
}

/** Unit codes are strings because D block's 01/02 must keep their leading zero. */
interface BlockLayout {
  floors: number;
  units: string[];
  flats: FlatSeed[];
}

const A_FLATS: FlatSeed[] = [
  { flat: "111", owner: ["Sunil Vasudev"], tenants: ["Drishti", "Gowri", "Pooja", "Shabana", "Shivani", "Vinitha"] },
  { flat: "112", owner: ["Sumal Vasudev"], tenants: ["Midhun Babu Kunnath Aven"] },
  { flat: "113", owner: ["Lakshmi", "Shashi"] },
  { flat: "114", owner: ["Nitish Agrawal"] },

  { flat: "211", owner: ["Gunjita Joshi", "Harshini Sharma", "Navneet", "Payal Sharma", "Priyanshu Sharma"] },
  { flat: "212", owner: ["Chaitali", "Chirag Talati"] },
  { flat: "213", owner: ["Krishna Bharathan", "Prasanna . B."], tenants: ["Vikram Ukani"] },
  { flat: "214", owner: ["Ramkumar V", "Shobanaramkumar", "Venkatachalam"] },

  { flat: "311", owner: ["Mahendran"], tenants: ["Soumyajit Lenka"] },
  { flat: "312", owner: ["Ashwin Baliga", "Bantwal Vittal Baliga", "Vittal Baliga"] },
  { flat: "313", owner: ["Vinod"], tenants: ["Bhadur Ahmed S M"] },
  { flat: "314", owner: ["Shankar Pal"] },

  { flat: "411", owner: ["Niveditha Pai", "Sunil"] },
  { flat: "412", tenants: ["Manish"] },
  { flat: "413", owner: ["Sangeeta Nair", "Vikram Pillai"], tenants: ["Praveen"] },
  { flat: "414", owner: ["Rajeswari Swamin…"], tenants: ["Karthik Muthuveer…"] },

  { flat: "511", owner: ["Trilok Agrawal"], tenants: ["Deepthi", "Nikhil Jogimahanti"] },
  { flat: "512", owner: ["Bhavesh Vats"], tenants: ["Sudheer"] },
  { flat: "513", owner: ["Akella Srilakshmi", "Chaitanya Namuduri"] },
  { flat: "514", owner: ["Rajasekhar Singuru"], tenants: ["Sonal Vinay Upadh…", "Vinay Upadhyay"] },

  { flat: "611", owner: ["Amarjit Giri", "Ashwini Giri"] },
  { flat: "612", owner: ["A. Karkal", "Abha Karkal", "Anjali Karkal"] },
  { flat: "613", owner: ["Manisha Gupta", "Pradeep Gupta"] },
  { flat: "614", owner: ["Annu Singhal"] },

  { flat: "711", owner: ["Sumal Vasudev"], tenants: ["Partha Das"] },
  { flat: "712", owner: ["Sumal Vasudev"], tenants: ["Abhishek Virendra", "Anurag Srivastava", "Kashika Sinha"] },
  { flat: "713", owner: ["Sunil Vasudev"], tenants: ["Pranab Chakraborty"] },
  { flat: "714", owner: ["Alok Shukla"], tenants: ["Samiksha Shamku…", "Sookthi K", "Vedha"] },

  { flat: "811", owner: ["B R Vasudev"], tenants: ["Gaurav Kawishwar"] },
  { flat: "812", owner: ["B R Vasudev"], tenants: ["Saurabh Upadhye"] },
  { flat: "813", owner: ["Sumal Vasudev"], tenants: ["Neelam"] },
  { flat: "814", owner: ["Anjana Pai"] },

  { flat: "911", tenants: ["Disha", "Manvi Jain", "Priyanshi Mittal", "Purva", "Sunita Goenka", "Trashika"] },
  { flat: "912", owner: ["Sanu Dutta"], tenants: ["Govind Singh Dhami", "Kiran Awasthi"] },
  { flat: "913", owner: ["Rajesh R"] },
  { flat: "914", owner: ["Indrani Das", "Koushik Das"] },

  { flat: "1011", owner: ["Shailendra Karve"] },
  { flat: "1012", owner: ["Sumal Vasudev"], tenants: ["Ashish Menon"] },
  { flat: "1013", owner: ["Pavan", "Suhasini"] },
  { flat: "1014", owner: ["Deepak Singh", "Rashmi Singh"] },

  { flat: "1111", owner: ["B R Vasudev"], tenants: ["Krupa", "Smit"] },
  { flat: "1112", owner: ["B R Vasudev"], tenants: ["Roshan Dave"] },
  { flat: "1113", owner: ["Sumal Vasudev"], tenants: ["Arindam Datta"] },
  { flat: "1114", owner: ["B R Vasudev"], tenants: ["Ankur Jain", "Shreya Muchhal"] },
];

const B_FLATS: FlatSeed[] = [
  { flat: "115", owner: ["B R Vasudev"], tenants: ["Meena Ravi", "Ravi"] },
  { flat: "116", tenants: ["Disha", "Khushi Khater", "Mihika Sane", "Prerna Lall"] },
  { flat: "117", owner: ["Sumal Vasudev"] },
  { flat: "118", owner: ["B R Vasudev"], tenants: ["Rishi Raj Singh"] },

  { flat: "215", owner: ["Amit Dhariwal", "Amit Kumar Dhariwal"], tenants: ["Indrabhushan Singh"] },
  { flat: "216", owner: ["Mkr Nair"], tenants: ["Rachit"] },
  { flat: "217", owner: ["Devendra Maurya"], tenants: ["Shrish Saurabh"] },
  { flat: "218", tenants: ["Brijesh Kr Agarwal"] },

  { flat: "315", owner: ["Dhannya Nair", "Manu Nair"] },
  { flat: "316", owner: ["Shubham Agrawal"] },
  { flat: "317", owner: ["Abhishek Srivastava"] },
  { flat: "318", owner: ["Vagesan Subrama…"], tenants: ["Srinivas Prabhu", "Vasudha Prabhu"] },

  { flat: "415", owner: ["Harish Kundargi"], tenants: ["Ranit Banerjee", "Soumi Ganguli"] },
  { flat: "416", owner: ["Ranabrata Khan"] },
  { flat: "417", owner: ["Rupali Pankaj Gurs…"], tenants: ["Prateek Galhotra"] },
  { flat: "418", owner: ["Wasim Latif"] },

  { flat: "515", owner: ["Ashwin Teegavarapu", "Divya Teegavarapu", "T Bhanumati", "T. Sreedhar"] },
  { flat: "516", owner: ["Jayanthi"] },
  { flat: "517", owner: ["Senthil"], tenants: ["Rajiv Chavali"] },
  { flat: "518", owner: ["Neeraj Chandra", "Priyanka"], tenants: ["Rishanku Goyal"] },

  { flat: "615", tenants: ["Anurashi Dixit", "Tapas Trivedi"] },
  { flat: "616", owner: ["Kallol Roy"], tenants: ["Manisankar Pati", "Pragyan Parimita S…"] },
  { flat: "617", owner: ["Siva Prakash"] },
  { flat: "618", owner: ["Sumal Vasudev"], tenants: ["Gargi Sen"] },

  { flat: "715", owner: ["Taru", "Vikas Wadhwa"] },
  { flat: "716", owner: ["Taruni Verma"], tenants: ["Umesh B"] },
  { flat: "717", owner: ["Maninder"], tenants: ["Siddarth Jain"] },
  { flat: "718", owner: ["Sayan Dev Lahiri"] },

  { flat: "815", owner: ["Manikandan"] },
  { flat: "816", owner: ["Sabyasachi Ruj"] },
  { flat: "817", owner: ["Deepak Bhandarkar", "Praveen"], tenants: ["Akshata Rawal"] },
  { flat: "818", owner: ["B R Vasudev"], tenants: ["Shilpi Banerjee", "Sujit Kumar Chakr…"] },

  { flat: "915", owner: ["Jhilik Chatterjee"], tenants: ["Iswaran"] },
  { flat: "916", owner: ["Shubhankar Ghosh", "Sk Ghosh", "Tuhina Bhattacharya"] },
  { flat: "917", owner: ["B R Vasudev"], tenants: ["Dipanjali Panda", "Sameer Panda"] },
  { flat: "918", owner: ["Pragati Bajpai", "Vivek Shukla"] },

  { flat: "1015", owner: ["Sumal Vasudev"], tenants: ["P Vaidya"] },
  { flat: "1016", owner: ["Arijit Banerjee", "Sinthia Roy Banerjee"] },
  { flat: "1017", owner: ["Sunil Vasudev"], tenants: ["Ayushi Pradhan", "Disha", "Prerna Fabwani", "Shaily", "Vanshika Verma"] },
  { flat: "1018", tenants: ["Akriti Vinay Verma", "Deepa", "Disha", "Shivani"] },
];

const C_FLATS: FlatSeed[] = [
  { flat: "119", owner: ["Hemanth Kumar"], tenants: ["Saurav Mijar", "Shreya"] },
  { flat: "120", owner: ["Madhumadhan Kar…", "Padma"], tenants: ["Debarpita Roy"] },
  { flat: "121", owner: ["Avtar Kaur", "Cheena Mehta", "Gagandeep Singh"] },
  { flat: "122", owner: ["B R Vasudev"], tenants: ["Anita", "Samir Pandey"] },

  { flat: "219", owner: ["Charana Eswaran"] },
  { flat: "220", owner: ["Sumal Vasudev"], tenants: ["Shilpi S Dash"] },
  { flat: "221", owner: ["Kapil", "Ritu Pokharna"] },
  { flat: "222", owner: ["Haja Hussain", "Sofia A"] },

  { flat: "319", owner: ["Anjana Pai", "Ganga Srinivas"] },
  { flat: "320", owner: ["B R Vasudev"], tenants: ["Bipin"] },
  { flat: "321", owner: ["Jayati Roy Chowd…", "Kaushik Saha"] },
  { flat: "322", owner: ["Assiya Shaikh"] },

  { flat: "419", owner: ["Sophia John"], tenants: ["Bahnisikha", "Raj"] },
  { flat: "420", owner: ["Anjali Gupta", "Gopal Prasad Aru…"], tenants: ["Bikram Ado", "Indu Chetri"] },
  { flat: "421", owner: ["Sanju Punnen", "Sonal Jadhav"], tenants: ["Pooja Singla", "Riya Goyal"] },
  { flat: "422", owner: ["Ruchir"] },

  { flat: "519", owner: ["Nitin Aggarwal", "Robin Aggarwal", "Shashi Agarwal"] },
  { flat: "520", owner: ["Hemant Kumar"] },
  { flat: "521", owner: ["Harish Rajoo Kam…"], tenants: ["Averi", "Utsav Ghosh"] },
  { flat: "522", owner: ["Kartik"], tenants: ["Jigyasa Goyal", "Mahek Bhatt", "Prerna Jain"] },

  { flat: "619", owner: ["Shivam Gopal"], tenants: ["Bharat"] },
  { flat: "620", owner: ["Vidyadhar Bk", "Vidyadhara Basti"], tenants: ["Ayushi Srivastava", "Mayank Srivastav L"] },
  { flat: "621", owner: ["Niranjan Acharya"], tenants: ["Nayudu", "Sreelatha Kandula"] },
  { flat: "622", tenants: ["Fallon", "Prachi Sharma", "Shailja", "Swagata"] },

  { flat: "719", tenants: ["Ajay Kiran"] },
  { flat: "720", owner: ["Vijayaraghavan"], tenants: ["Shubham Mathur", "Vanshika Mathur"] },
  { flat: "721", owner: ["George Thomas"], tenants: ["Mohinder Singh Ra…"] },
  { flat: "722", owner: ["Bhupinder Singh", "Col Bhupinder Singh"], tenants: ["Anish Dhyanu", "Dineshkumar"] },

  { flat: "819", owner: ["Banita", "Banita Mahakud", "Ganga Srinivas", "Satya Narayan Go…"] },
  { flat: "820", owner: ["Ipsita Dash", "Sovan Kumar Hota"], tenants: ["Siddhant Jain", "Smriti Siddhant Jain"] },
  { flat: "821", owner: ["Ranjan Kumar Pra…"], tenants: ["Ranjan"] },
  { flat: "822", owner: ["Aruna Kumar E", "Asokan Edakkalavan"], tenants: ["Chaitali Maity", "Sougata Biswas"] },

  { flat: "919", owner: ["Mathew", "Robin Mathew"], tenants: ["Surya"] },
  { flat: "920", owner: ["Bhakta"], tenants: ["Srijanee Biswas"] },
  { flat: "921", owner: ["Rajesh Jethwa", "Vipula Jethwa"] },
  { flat: "922", owner: ["Dr. Sunil Vasudev"], tenants: ["Aastha Saxena", "Anamika", "Anshu Thakur", "Disha", "Famidha Thurab", "Jahanavi Sachdeva", "Mitali Saraf", "Swati Vishwakarma", "Tanvi Mittal", "Viharika"] },

  { flat: "1019", owner: ["Rituraj", "Sonam Prasad"], tenants: ["Mugundan"] },
  { flat: "1020", owner: ["Sumal Vasudev"], tenants: ["Harshal"] },
  { flat: "1021", owner: ["Kalyan Banerjee"] },
  { flat: "1022", owner: ["Mano Singh"], tenants: ["Anita Srivastava"] },

  { flat: "1119", owner: ["Sunil Vasudev"], tenants: ["Srinivas"] },
  { flat: "1120", owner: ["Sunil Vasudev"], tenants: ["Danny Jacob"] },
  { flat: "1121", owner: ["Sunil Vasudev"], tenants: ["Rajul Gupta", "Shalu Dengre"] },
  { flat: "1122", owner: ["Dr. Sunil Vasudev"], tenants: ["Disha", "Ishiqa Jhajharia", "Kushi Amin", "Lavina Chowta", "Richa Agarwal", "Sanjeevini", "Sita"] },
];

const D_FLATS: FlatSeed[] = [
  { flat: "101", owner: ["Ashwani Gupta"], tenants: ["Rashmi"] },
  { flat: "102", owner: ["Chetan Tenginkai"], tenants: ["Subham Kumar"] },
  { flat: "123", owner: ["B R Vasudev"], tenants: ["Jyoti"] },
  { flat: "124", owner: ["Jenifer Sofia", "Lance Sathiya Raj"], tenants: ["Rajasekar"] },

  { flat: "201", owner: ["Manish", "Surabhi Lal"] },
  { flat: "202", owner: ["Darpan Tripathi"], tenants: ["Santhosh"] },
  { flat: "223", owner: ["Anjali Vithalkar", "Arvind Vithalkar"] },
  { flat: "224", owner: ["Aneeta Vithalkar", "Anurag"] },

  { flat: "301", owner: ["Suresh", "Suresh Buddaraju"], tenants: ["Manisha Tripathy", "T Tejaswini"] },
  { flat: "302", owner: ["Rajesh", "Rajesh Singh"], tenants: ["Ruchika Sharma", "Vaibhav Sharma"] },
  { flat: "323", owner: ["Mohan"], tenants: ["Arun Jose", "Biji"] },
  { flat: "324", owner: ["Mahaboob Sharif B"] },

  { flat: "401", owner: ["Geetesh Kaushik", "Ishita Kaushik"], tenants: ["Pallavi Trisha", "Saloni"] },
  { flat: "402", owner: ["Bala K"], tenants: ["Dhiraj Kumar"] },
  { flat: "423", tenants: ["Amaresh"] },
  { flat: "424", owner: ["Amit Priyadarshi"] },

  { flat: "501", owner: ["Rishabh Kalra"], tenants: ["Brinda Naik"] },
  { flat: "502", owner: ["Rakesh"], tenants: ["Ritu Raj", "Rupa Rani"] },
  { flat: "523", owner: ["Ameya Shetty"], tenants: ["Kausiki", "Sravya"] },
  { flat: "524", owner: ["Anindita Ghosh", "Goutam Ghosh"] },

  { flat: "601", owner: ["Senthil Kumar Sv"] },
  { flat: "602", owner: ["Ayush Bajpai"], tenants: ["Mukul Chaurasia", "Shweta Chaurasia"] },
  { flat: "623", owner: ["Kuntal"] },
  { flat: "624", owner: ["Kaustav Dutta"], tenants: ["Devdatta Pandey"] },

  { flat: "701", owner: ["B R Vasudev"], tenants: ["Ashwani Bhatnagar"] },
  { flat: "702", owner: ["Birendra Shah"], tenants: ["Naveen"] },
  { flat: "723", owner: ["Arjun Singh"], tenants: ["Himanshu", "Rohan"] },
  { flat: "724", owner: ["Chandni Shah", "Shrujal Shah"] },

  { flat: "801", owner: ["Sunil Vasudev"], tenants: ["Prasanna R", "Vishnupriya R"] },
  { flat: "802", owner: ["Vishal .Khushboo…"] },
  { flat: "823" },
  { flat: "824", owner: ["Kishore Raj"] },

  { flat: "901", owner: ["Sumal Vasudev"], tenants: ["Ankit Gajera"] },
  { flat: "902", owner: ["Anupam Ranakoti", "Sushma Ranakoti"] },
  { flat: "923", owner: ["Mayank Pant"], tenants: ["Anju Bhardwaj", "Sneha"] },
  { flat: "924", owner: ["Kamala Sinha", "Neha Raj", "Nidhi"] },

  { flat: "1001", owner: ["B R Vasudev"], tenants: ["Rajeev Mishra", "Shikha Sisodia"] },
  { flat: "1002", owner: ["Rahul Singh Sisodia", "Rahul Sisodia"], tenants: ["Goutam Mukherjee", "Priyanka Mukherjee"] },
  { flat: "1023", owner: ["Pankaj Kumar B", "Surya Kumari Ghu…"] },
  { flat: "1024", owner: ["Sumal Vasudev"], tenants: ["Nishasushma", "Pravin Kumar R"] },

  { flat: "1101", owner: ["Sumal Vasudev"], tenants: ["Pranita Jain", "Saransh Jain"] },
  { flat: "1102", owner: ["Deepchand G"] },
  { flat: "1123", owner: ["Sumal Vasudev"] },
  { flat: "1124", owner: ["Sumal Vasudev"], tenants: ["Vivek Sonaje"] },
];

const E_FLATS: FlatSeed[] = [
  { flat: "103", owner: ["Vikas Rajput"], tenants: ["Krishnapriya Mano…", "Shilpa Abraham"] },
  { flat: "104", owner: ["Sanjay Gore", "Sneha Gore"] },
  { flat: "105", owner: ["Arunkumar O N"] },
  { flat: "106", owner: ["Subhasis Mahapatra"] },

  { flat: "203", owner: ["Amol Kundalik Dar…", "Sayali Amol Daran…"] },
  { flat: "204", owner: ["Bharti Kumari"] },
  { flat: "205", owner: ["Darshan Vijayarag…", "Vijayaragavan S", "Vithiya"] },
  { flat: "206", owner: ["Saurabh Shekhar J…"], tenants: ["Sandeep", "Sriya"] },

  { flat: "303", owner: ["Kaustuv Vatsyayan"] },
  { flat: "304", owner: ["Ranjith Kumar Bha…"] },
  { flat: "305", owner: ["D V Sekhar Komala"], tenants: ["Tanverr Asif"] },
  { flat: "306", owner: ["Rohit Dixit"], tenants: ["Amogh Lale", "Bhargavi Kulkarni"] },

  { flat: "403", owner: ["Kumaravel", "Kumaravel Karuna…"], tenants: ["Saurabh Shukla"] },
  { flat: "404", owner: ["Pallavi Gangwar"] },
  { flat: "405", owner: ["Atun Tripathy", "Saswati"], tenants: ["Shirsha Sengupta", "Sohini Mukhopadh…"] },
  { flat: "406", owner: ["Nitin Agrahari", "Reetz"] },

  { flat: "503", owner: ["Shilpi Banerjee", "Sujit Kumar Chakr…"], tenants: ["Akanksha", "Dheeraj Kumar"] },
  { flat: "504", owner: ["Ahhiong Tham"] },
  { flat: "505", owner: ["Khanappa Borago…"], tenants: ["Deepak Singh Negi", "Hema"] },
  { flat: "506", owner: ["Amit Kumar Jha"], tenants: ["Amit Mishra"] },

  { flat: "603", owner: ["Shailendra Karve"], tenants: ["Avinash Pai", "Divya Pai"] },
  { flat: "604", owner: ["Ashish", "Ashish Shankar Du…"] },
  { flat: "605", owner: ["Abhishek Dey", "Kusumika Sengupta"], tenants: ["Avi Singhal", "Zalak"] },
  { flat: "606", owner: ["Shirsendu Sarkar"], tenants: ["Sudhir Swarup"] },

  { flat: "703", owner: ["Abhishek Shukla", "Aditya", "Krishna Gopal"] },
  { flat: "704", owner: ["Ankur Khanna"], tenants: ["Manish Kumar"] },
  { flat: "705", owner: ["Devaki", "Elangovan Duraisa…"], tenants: ["Anjali"] },
  { flat: "706", owner: ["Dipti Javia", "Kevin Javia"], tenants: ["Ajay Tanwar"] },

  { flat: "803", owner: ["Deepika Singh", "Vikas Singh"] },
  { flat: "804", owner: ["Vishakha"], tenants: ["Mangesh Gakare"] },
  { flat: "805", owner: ["Balachandar"], tenants: ["Prince Shah", "Priya Agarwal"] },
  { flat: "806", owner: ["Nisha Mishra"], tenants: ["Utsav Nagwan"] },

  { flat: "903", owner: ["G Sriram"], tenants: ["Aruna", "Devaki Narayanas…", "Sai Aditya"] },
  { flat: "904", owner: ["Gaurav"], tenants: ["Milind", "Utkarsh Ranjan"] },
  { flat: "905", owner: ["Shantanu Sinha"], tenants: ["Amit"] },
  { flat: "906", owner: ["Shubajyoti Sen"], tenants: ["Anurag Agrawal"] },

  { flat: "1003", owner: ["Rajesh Dwivedi"], tenants: ["Neha Jalke", "Rahul"] },
  { flat: "1004", owner: ["Resident Name"] },
  { flat: "1005", owner: ["Anup Balachandran", "Malu Jayalal"], tenants: ["Ayushi Srivastava", "Mayank Srivastav L"] },
  { flat: "1006", owner: ["Manish"] },
];

const F_FLATS: FlatSeed[] = [
  { flat: "107", tenants: ["Nikhil", "Sharmistha Mondal"] },
  { flat: "108", owner: ["Sumal Vasudev"], tenants: ["Nitin Dsouza"] },
  { flat: "109", owner: ["B R Vasudev"], tenants: ["Lawrence", "Zidanne"] },
  { flat: "110", owner: ["B R Vasudev"], tenants: ["Nishmita Shetty", "Suvin"] },

  { flat: "207", owner: ["Tirumala Rao Burre"], tenants: ["Piyush Shah", "Samta Grover"] },
  { flat: "208", owner: ["R.Srinivasan"], tenants: ["Avirup Das"] },
  { flat: "209", owner: ["Roopa"], tenants: ["Niharika Agarwal"] },
  { flat: "210", owner: ["Rajesh Kumar Sha…", "Sangita", "Sarita Kumari", "Shivnath Sharma"] },

  { flat: "307", owner: ["Susilkumar Vasud…"] },
  { flat: "308", owner: ["Manoj Mavally"], tenants: ["Chetan Patil"] },
  { flat: "309", owner: ["Kannusami", "V Kannusami"], tenants: ["Abhigyan Srivastava", "Akshita Srivastava"] },
  { flat: "310", owner: ["Deborah Rachel J…", "Sweety Mathew"] },

  { flat: "407", owner: ["Arpit Vaish"] },
  { flat: "408", owner: ["Ashwani Goyal", "Shradha Goyal"] },
  { flat: "409", tenants: ["Geeta Prajapati", "Rakesh"] },
  { flat: "410", owner: ["Anoj Nair", "Uma Anoj"], tenants: ["Aaron Cherian"] },

  { flat: "507", owner: ["Rashmi"] },
  { flat: "508", owner: ["Vinoth Kumar Kasi"] },
  { flat: "509", owner: ["Amrita"] },
  { flat: "510", owner: ["Amit", "Surbhi"] },

  { flat: "607", owner: ["Nagesh Mittal"], tenants: ["Radhika Sharma", "Roshni Bamane"] },
  { flat: "608", owner: ["Betty Johnson", "Rajan"] },
  { flat: "610", owner: ["Ranjeet Ranjan"], tenants: ["Pranavi Singh"] },

  { flat: "707", owner: ["Dr. Madhu", "Madhu Jha", "Prasann K Jha"], tenants: ["Anjali", "Avnish"] },
  { flat: "708", owner: ["Hirdesh Shrivastava", "Roopam Shrivastav"] },
  { flat: "709", owner: ["Ranjith Kumar Bha…"] },
  { flat: "710", owner: ["Ashish"], tenants: ["Abhijeet Banerjee", "Gautam Singh"] },

  { flat: "807", owner: ["J N Tripathi", "Saurabh Tripathi"], tenants: ["Rahul Dhaker"] },
  { flat: "808", owner: ["Abhiranjan Kumar", "B Kumar And Shak…", "Dr B Kumar", "Raman Kumar", "Shakuntala Kumari"] },
  { flat: "809", owner: ["Abhinav Singh", "Vijetha Krishnappa…"], tenants: ["Bila Banerjee", "Moumita Banerjee"] },
  { flat: "810", owner: ["Kingshuk", "Sharda Diwan"], tenants: ["Ankita Srivastava", "Vikash Srivastava"] },

  { flat: "907", owner: ["Prasanth", "Prasanth Perumal"], tenants: ["Asish Singh", "Chitra"] },
  { flat: "908", owner: ["Antara Vinayachan…", "Vinay Chandran"] },
  { flat: "909", owner: ["Smita"], tenants: ["Virender Thakur"] },
  { flat: "910", owner: ["Rajeev P A"], tenants: ["Gaurav Awasthi", "Harshita"] },

  { flat: "1007", owner: ["Asha Rajmohan", "Rajmohan"] },
  { flat: "1008", owner: ["Ninad Joshi"], tenants: ["Neel Rami"] },
  { flat: "1009", owner: ["Nakul", "Nakul Srinivas"], tenants: ["Akash Kumar", "Neha", "Sunny Singh"] },
  { flat: "1010", tenants: ["Nitish Goel"] },

  { flat: "1107", owner: ["Hemanth Agarwal"], tenants: ["Sharon"] },
  { flat: "1108", owner: ["Vikas Gera"], tenants: ["Vaibhav Kumar", "Vaibhav Srivastava"] },
  { flat: "1109", owner: ["Dr. Sunil Vasudev"] },
  { flat: "1110", owner: ["B R Vasudev"], tenants: ["Shirsendu Sarkar"] },
];

const G_FLATS: FlatSeed[] = [
  { flat: "125", owner: ["Sajin K"], tenants: ["Ajinkya"] },
  { flat: "126", owner: ["Pratibha"], tenants: ["Anirudh Rajan", "Ashwin Anirudh", "Lalitha", "Lalitha Dad", "Lalithambigai N"] },
  { flat: "127", owner: ["Kirti", "Rahul"] },
  { flat: "128", owner: ["Rajdeep Ghosh", "Satavisha Bhaduri…"] },

  { flat: "225", owner: ["Ganesh L"] },
  { flat: "226", owner: ["Mukul Rajan Gupta"], tenants: ["Amrita Lakshmi"] },
  { flat: "227", owner: ["Kiran Kumar Tiruve…"], tenants: ["Jignesh Manilal M…"] },
  { flat: "228", owner: ["Farisa"], tenants: ["Deepti", "Pavan Mishra"] },

  { flat: "325", owner: ["Nishwitha Brijesh"], tenants: ["Shantharam P"] },
  { flat: "326", tenants: ["Swati"] },
  { flat: "327", owner: ["Komal Raj", "Rishabh Raj"], tenants: ["Dr Sayali", "Ravi Shanker Tiwari"] },
  { flat: "328", owner: ["Shiju Paul"], tenants: ["Chandan Bhatia"] },

  { flat: "425", owner: ["Rohit Panda"], tenants: ["Samrudhi", "Tannavi Tiwari"] },
  { flat: "426", owner: ["Vivek Kumar"], tenants: ["Ishita", "Pramod Kumar", "Prasant"] },
  { flat: "427", owner: ["Rohit Dwivedi", "Stuti Dwivedi"], tenants: ["Rahul Mondal"] },
  { flat: "428", owner: ["Vivek Tambe"], tenants: ["Komal Raj", "Rishabh Raj"] },

  { flat: "525", owner: ["Deepa Lakshmanan"] },
  { flat: "526", owner: ["Prashant"], tenants: ["Balaji P V", "Yamini Baskar"] },
  { flat: "527", owner: ["Avinash Baviskar"], tenants: ["Raghuram"] },
  { flat: "528", owner: ["Basheer"], tenants: ["Shahid Ansari", "Sohaib Khan"] },

  { flat: "625", tenants: ["Dinesh Kumar Sinha"] },
  { flat: "626", owner: ["Arun Antony"], tenants: ["Akash Khandelwal"] },
  { flat: "627", owner: ["Manak", "Manak Babra"], tenants: ["Pritam Samantaray"] },
  { flat: "628", owner: ["Amulya", "Sonal"], tenants: ["Aradhya Parikh"] },

  { flat: "725", owner: ["Madhusoodhana…"] },
  { flat: "726", owner: ["Johny", "Sheeja Varghese"], tenants: ["Dev Hariharan"] },
  { flat: "727", owner: ["Bhageeradhi T K", "Dr Bipin P P", "Shilly Bipin"] },
  { flat: "728", owner: ["Vinay"], tenants: ["Aman Punia"] },

  { flat: "825", owner: ["Prateek Galhotra"], tenants: ["Ayushi Bhalotia", "Palak Pandey"] },
  { flat: "826", owner: ["Prateek Jain"], tenants: ["Chhavi Shandilya", "Piyush Thakur"] },
  { flat: "827", owner: ["Anindita Gupta"] },
  { flat: "828", owner: ["Ashish Ramesh Pa…"], tenants: ["Gitesh Kumar"] },

  { flat: "925", owner: ["Shashi Ranjan"], tenants: ["Arun Awasthi", "Prakarsh Awasthi"] },
  { flat: "926", owner: ["Nitin Bansal", "Shilpi Agrawal"] },
  { flat: "927", owner: ["Supriyo Roy Chou…"] },
  { flat: "928", owner: ["Rewa Sharma", "Shailesh Kumar Sh…"] },

  { flat: "1025", owner: ["Vikram Singh Kush…"], tenants: ["Aalok Sheth", "Kanchi Shah"] },
  { flat: "1026", owner: ["Sreemoyee Banerjee"] },
  { flat: "1027", owner: ["Shwetank", "Somnath Chatterjee", "Sreenita Chatterjee", "Subha Chatterjee"] },
  { flat: "1028", owner: ["Ayushman Tripathi", "Rupali Tripathi"] },

  { flat: "1125", owner: ["Ekta Yadav", "Gajanand Yadav"] },
  { flat: "1126", owner: ["Nikki Dabas", "Rahul Dabas", "Worship Chaudhary"] },
  { flat: "1127", owner: ["Chandan Shrestha"], tenants: ["Akshay Sawant", "Shreyas Pachpande"] },
  { flat: "1128", owner: ["Papia Banerji", "Somnath Chatterjee", "Subhendu Banerjee"], tenants: ["Apsara", "Suraj Kumar Chetry"] },
];

const layouts: Partial<Record<Block, BlockLayout>> = {
  A: { floors: 11, units: ["11", "12", "13", "14"], flats: A_FLATS },
  B: { floors: 10, units: ["15", "16", "17", "18"], flats: B_FLATS },
  C: { floors: 11, units: ["19", "20", "21", "22"], flats: C_FLATS },
  D: { floors: 11, units: ["01", "02", "23", "24"], flats: D_FLATS },
  E: { floors: 10, units: ["03", "04", "05", "06"], flats: E_FLATS },
  F: { floors: 11, units: ["07", "08", "09", "10"], flats: F_FLATS },
  G: { floors: 11, units: ["25", "26", "27", "28"], flats: G_FLATS },
};

const ownerList: Owner[] = [];
const ownerIdByKey = new Map<string, string>();

function ownerIdFor(names: string[]): string {
  const key = names.join(" & ").toLowerCase();
  const existing = ownerIdByKey.get(key);
  if (existing) return existing;
  const id = `owner-${ownerIdByKey.size + 1}`;
  ownerIdByKey.set(key, id);
  ownerList.push({ id, names, disabled: false });
  return id;
}

function buildHouses(): House[] {
  const built: House[] = [];
  for (const [block, layout] of Object.entries(layouts) as [Block, BlockLayout][]) {
    const byFlat = new Map(layout.flats.map((f) => [f.flat, f]));
    for (let floor = 1; floor <= layout.floors; floor++) {
      for (const unit of layout.units) {
        const flatNo = `${floor}${unit}`;
        const seed = byFlat.get(flatNo);
        built.push({
          id: `house-${block}-${flatNo}`,
          block,
          floor,
          flatNo,
          ownerId: seed?.owner ? ownerIdFor(seed.owner) : undefined,
          tenantNames: seed?.tenants ?? [],
        });
      }
    }
  }
  return built;
}

export const houses: House[] = buildHouses();
export const owners: Owner[] = ownerList;

/** Blocks that have been transcribed so far — the rest are awaiting the list. */
export const knownBlocks = Object.keys(layouts) as Block[];

export function ownerFlats(ownerId: string): House[] {
  return houses.filter((h) => h.ownerId === ownerId);
}

export function ownerNamed(name: string): Owner {
  const found = owners.find((o) => o.names.length === 1 && o.names[0] === name);
  if (!found) throw new Error(`Unknown owner ${name}`);
  return found;
}

export function flat(block: Block, flatNo: string): House {
  const found = houses.find((h) => h.block === block && h.flatNo === flatNo);
  if (!found) throw new Error(`Unknown flat ${block}-${flatNo}`);
  return found;
}
