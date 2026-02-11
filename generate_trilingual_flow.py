#!/usr/bin/env python3
"""
Generate Complete Tri-lingual Flow for Collectorate Jharsugda Odisha
This script generates a complete chatbot flow with English, Hindi, and Odia support.
"""

import json

# Translation mappings
TRANSLATIONS = {
    "main_menu": {
        "en": {
            "header": "🏛️ *Collectorate Jharsugda Odisha*\n\n*Citizen Services Menu*\n\nPlease select a service from the menu below:",
            "button": "View Services",
            "section_title": "Available Services",
            "grievance": {"title": "📝 File Grievance", "desc": "Register a complaint"},
            "appointment": {"title": "📅 Book Appointment", "desc": "Schedule meeting"},
            "track": {"title": "🔍 Track Status", "desc": "Check your request"},
            "help": {"title": "ℹ️ Help & Contact", "desc": "Get assistance"}
        },
        "hi": {
            "header": "🏛️ *कलेक्टोरेट झारसुगड़ा ओडिशा*\n\n*नागरिक सेवाएं मेनू*\n\nकृपया नीचे दिए गए मेनू से एक सेवा चुनें:",
            "button": "सेवाएं देखें",
            "section_title": "उपलब्ध सेवाएं",
            "grievance": {"title": "📝 शिकायत दर्ज करें", "desc": "शिकायत पंजीकृत करें"},
            "appointment": {"title": "📅 अपॉइंटमेंट बुक करें", "desc": "बैठक निर्धारित करें"},
            "track": {"title": "🔍 स्थिति ट्रैक करें", "desc": "अपना अनुरोध जांचें"},
            "help": {"title": "ℹ️ सहायता और संपर्क", "desc": "सहायता प्राप्त करें"}
        },
        "or": {
            "header": "🏛️ *କଲେକ୍ଟରେଟ୍ ଝାରସୁଗଡା ଓଡିଶା*\n\n*ନାଗରିକ ସେବା ମେନୁ*\n\nଦୟାକରି ନିମ୍ନରେ ଥିବା ମେନୁରୁ ଏକ ସେବା ବାଛନ୍ତୁ:",
            "button": "ସେବା ଦେଖନ୍ତୁ",
            "section_title": "ଉପଲବ୍ଧ ସେବାଗୁଡିକ",
            "grievance": {"title": "📝 ଅଭିଯୋଗ ଦାଖଲ କରନ୍ତୁ", "desc": "ଅଭିଯୋଗ ପଞ୍ଜୀକରଣ କରନ୍ତୁ"},
            "appointment": {"title": "📅 ନିଯୁକ୍ତି ବୁକ୍ କରନ୍ତୁ", "desc": "ସାକ୍ଷାତ ନିର୍ଧାରଣ କରନ୍ତୁ"},
            "track": {"title": "🔍 ସ୍ଥିତି ଟ୍ରାକ୍ କରନ୍ତୁ", "desc": "ଆପଣଙ୍କ ଅନୁରୋଧ ଯାଞ୍ଚ କରନ୍ତୁ"},
            "help": {"title": "ℹ️ ସହାୟତା ଏବଂ ଯୋଗାଯୋଗ", "desc": "ସହାୟତା ପାଆନ୍ତୁ"}
        }
    },
    "grievance_flow": {
        "en": {
            "name_prompt": "📝 *File a Grievance*\n\nPlease enter your full name:",
            "dept_prompt": "Please select the concerned department:",
            "desc_prompt": "Please describe your grievance in detail:\n\n• Include specific dates\n• Mention exact location\n• Provide relevant details",
            "location_prompt": "📍 *Location Information*\n\nWould you like to add location details?",
            "address_prompt": "Please type the complete address:",
            "media_prompt": "📎 *Supporting Documents*\n\nWould you like to attach supporting documents/photos?\n\n✅ *Supported formats:*\n📄 PDF, Word, Excel\n📷 Images (JPG, PNG)\n\n_You can upload multiple files_",
            "confirmation": "📋 *Grievance Summary*\n\n👤 *Name:* {{citizenName}}\n🏢 *Department:* {{departmentName}}\n📝 *Description:* {{description}}\n📍 *Location:* {{location.address}}\n📎 *Attachments:* {{media.length}} file(s)\n\n*Please confirm to submit your grievance.*",
            "success": "✅ *Grievance Registered Successfully!*\n\n🎫 *Reference Number:* {{grievanceId}}\n\n📧 You will receive updates on your registered mobile number.\n\nThank you for using Collectorate Jharsugda Odisha services!"
        },
        "hi": {
            "name_prompt": "📝 *शिकायत दर्ज करें*\n\nकृपया अपना पूरा नाम दर्ज करें:",
            "dept_prompt": "कृपया संबंधित विभाग चुनें:",
            "desc_prompt": "कृपया अपनी शिकायत का विस्तार से वर्णन करें:\n\n• विशिष्ट तिथियां शामिल करें\n• सटीक स्थान का उल्लेख करें\n• प्रासंगिक विवरण प्रदान करें",
            "location_prompt": "📍 *स्थान जानकारी*\n\nक्या आप स्थान विवरण जोड़ना चाहेंगे?",
            "address_prompt": "कृपया पूरा पता टाइप करें:",
            "media_prompt": "📎 *सहायक दस्तावेज़*\n\nक्या आप सहायक दस्तावेज़/फोटो संलग्न करना चाहेंगे?\n\n✅ *समर्थित प्रारूप:*\n📄 PDF, Word, Excel\n📷 छवियां (JPG, PNG)\n\n_आप कई फाइलें अपलोड कर सकते हैं_",
            "confirmation": "📋 *शिकायत सारांश*\n\n👤 *नाम:* {{citizenName}}\n🏢 *विभाग:* {{departmentName}}\n📝 *विवरण:* {{description}}\n📍 *स्थान:* {{location.address}}\n📎 *संलग्नक:* {{media.length}} फाइल(एं)\n\n*सबमिशन की पुष्टि करें?*",
            "success": "✅ *शिकायत सफलतापूर्वक पंजीकृत!*\n\n🎫 *संदर्भ संख्या:* {{grievanceId}}\n\n📧 आपको अपने पंजीकृत मोबाइल नंबर पर अपडेट प्राप्त होंगे।\n\nकलेक्टोरेट झारसुगड़ा ओडिशा सेवाओं का उपयोग करने के लिए धन्यवाद!"
        },
        "or": {
            "name_prompt": "📝 *ଅଭିଯୋଗ ଦାଖଲ କରନ୍ତୁ*\n\nଦୟାକରି ଆପଣଙ୍କର ସମ୍ପୂର୍ଣ୍ଣ ନାମ ପ୍ରବେଶ କରନ୍ତୁ:",
            "dept_prompt": "ଦୟାକରି ସମ୍ପୃକ୍ତ ବିଭାଗ ବାଛନ୍ତୁ:",
            "desc_prompt": "ଦୟାକରି ଆପଣଙ୍କର ଅଭିଯୋଗକୁ ବିସ୍ତୃତ ଭାବରେ ବର୍ଣ୍ଣନା କରନ୍ତୁ:\n\n• ନିର୍ଦ୍ଦିଷ୍ଟ ତାରିଖ ଅନ୍ତର୍ଭୁକ୍ତ କରନ୍ତୁ\n• ସଠିକ୍ ସ୍ଥାନ ଉଲ୍ଲେଖ କରନ୍ତୁ\n• ପ୍ରାସଙ୍ଗିକ ବିବରଣୀ ପ୍ରଦାନ କରନ୍ତୁ",
            "location_prompt": "📍 *ସ୍ଥାନ ସୂଚନା*\n\nଆପଣ ସ୍ଥାନ ବିବରଣୀ ଯୋଡିବାକୁ ଚାହୁଁଛନ୍ତି କି?",
            "address_prompt": "ଦୟାକରି ସମ୍ପୂର୍ଣ୍ଣ ଠିକଣା ଟାଇପ୍ କରନ୍ତୁ:",
            "media_prompt": "📎 *ସହାୟକ ଡକ୍ୟୁମେଣ୍ଟ*\n\nଆପଣ ସହାୟକ ଡକ୍ୟୁମେଣ୍ଟ/ଫଟୋ ସଂଲଗ୍ନ କରିବାକୁ ଚାହୁଁଛନ୍ତି କି?\n\n✅ *ସମର୍ଥିତ ଫର୍ମାଟ୍:*\n📄 PDF, Word, Excel\n📷 ଚିତ୍ର (JPG, PNG)\n\n_ଆପଣ ଏକାଧିକ ଫାଇଲ୍ ଅପଲୋଡ୍ କରିପାରିବେ_",
            "confirmation": "📋 *ଅଭିଯୋଗ ସାରାଂଶ*\n\n👤 *ନାମ:* {{citizenName}}\n🏢 *ବିଭାଗ:* {{departmentName}}\n📝 *ବିବରଣୀ:* {{description}}\n📍 *ସ୍ଥାନ:* {{location.address}}\n📎 *ସଂଲଗ୍ନକ:* {{media.length}} ଫାଇଲ୍\n\n*ଦାଖଲ ନିଶ୍ଚିତ କରନ୍ତୁ?*",
            "success": "✅ *ଅଭିଯୋଗ ସଫଳତାର ସହିତ ପଞ୍ଜୀକୃତ!*\n\n🎫 *ରେଫରେନ୍ସ ନମ୍ବର:* {{grievanceId}}\n\n📧 ଆପଣ ଆପଣଙ୍କର ପଞ୍ଜୀକୃତ ମୋବାଇଲ୍ ନମ୍ବରରେ ଅପଡେଟ୍ ପାଇବେ।\n\nକଲେକ୍ଟରେଟ୍ ଝାରସୁଗଡା ଓଡିଶା ସେବା ବ୍ୟବହାର କରିଥିବାରୁ ଧନ୍ୟବାଦ!"
        }
    }
}

def generate_flow():
    """Generate the complete tri-lingual flow"""
    
    flow = {
        "metadata": {
            "name": "Collectorate Jharsugda Odisha - Complete Tri-lingual",
            "description": "Complete chatbot flow with full English, Hindi, and Odia support",
            "companyId": "",
            "version": 1,
            "isActive": True
        },
        "nodes": [],
        "edges": [],
        "viewport": {"x": 0, "y": 0, "zoom": 0.5}
    }
    
    # Start node
    flow["nodes"].append({
        "id": "start_node",
        "type": "start",
        "position": {"x": 100, "y": 600},
        "data": {
            "label": "Start",
            "trigger": "hi",
            "triggerType": "keyword"
        }
    })
    
    # Language selection
    flow["nodes"].append({
        "id": "language_selection",
        "type": "buttonMessage",
        "position": {"x": 350, "y": 600},
        "data": {
            "label": "Language Selection",
            "messageText": "🇮🇳 *Welcome to Collectorate Jharsugda Odisha*\n\n📱 Official Digital Service Portal\n\nPlease select your preferred language:\nकृपया अपनी पसंदीदा भाषा चुनें:\nଦୟାକରି ଆପଣଙ୍କର ପସନ୍ଦର ଭାଷା ବାଛନ୍ତୁ:",
            "buttons": [
                {"id": "btn_en", "text": "🇬🇧 English", "type": "quick_reply"},
                {"id": "btn_hi", "text": "🇮🇳 हिंदी", "type": "quick_reply"},
                {"id": "btn_or", "text": "🇮🇳 ଓଡ଼ିଆ", "type": "quick_reply"}
            ]
        }
    })
    
    flow["edges"].append({
        "id": "e1",
        "source": "start_node",
        "target": "language_selection",
        "animated": True
    })
    
    # Generate nodes for each language
    languages = [
        {"code": "en", "name": "English", "y_offset": 0},
        {"code": "hi", "name": "Hindi", "y_offset": 800},
        {"code": "or", "name": "Odia", "y_offset": 1600}
    ]
    
    edge_counter = 2
    
    for lang in languages:
        lang_code = lang["code"]
        y_base = lang["y_offset"]
        
        # Main Menu
        menu_data = TRANSLATIONS["main_menu"][lang_code]
        flow["nodes"].append({
            "id": f"main_menu_{lang_code}",
            "type": "listMessage",
            "position": {"x": 650, "y": y_base + 100},
            "data": {
                "label": f"Main Menu ({lang['name']})",
                "messageText": menu_data["header"],
                "buttonText": menu_data["button"],
                "sections": [{
                    "title": menu_data["section_title"],
                    "rows": [
                        {"id": f"grv_{lang_code}", "title": menu_data["grievance"]["title"], "description": menu_data["grievance"]["desc"]},
                        {"id": f"track_{lang_code}", "title": menu_data["track"]["title"], "description": menu_data["track"]["desc"]},
                        {"id": f"help_{lang_code}", "title": menu_data["help"]["title"], "description": menu_data["help"]["desc"]}
                    ]
                }]
            }
        })
        
        # Connect language selection to main menu
        flow["edges"].append({
            "id": f"e{edge_counter}",
            "source": "language_selection",
            "target": f"main_menu_{lang_code}",
            "sourceHandle": f"btn_{lang_code}",
            "label": lang["name"]
        })
        edge_counter += 1
        
        # Grievance Flow Nodes
        grv_data = TRANSLATIONS["grievance_flow"][lang_code]
        
        # 1. Citizen Name
        flow["nodes"].append({
            "id": f"citizen_name_{lang_code}",
            "type": "userInput",
            "position": {"x": 950, "y": y_base + 50},
            "data": {
                "label": f"Citizen Name ({lang['name']})",
                "messageText": grv_data["name_prompt"],
                "inputType": "text",
                "saveToField": "citizenName",
                "validation": {
                    "required": True,
                    "minLength": 2,
                    "maxLength": 100
                },
                "placeholder": "Enter your full name"
            }
        })
        
        # 2. Department Selection
        flow["nodes"].append({
            "id": f"department_selection_{lang_code}",
            "type": "listMessage",
            "position": {"x": 1250, "y": y_base + 50},
            "data": {
                "label": f"Department Selection ({lang['name']})",
                "messageText": grv_data["dept_prompt"],
                "buttonText": "Select Department" if lang_code == "en" else ("विभाग चुनें" if lang_code == "hi" else "ବିଭାଗ ବାଛନ୍ତୁ"),
                "isDynamic": True,
                "dynamicSource": "departments",
                "sections": [{
                    "title": "Government Departments",
                    "rows": [
                        {"id": "dept_health", "title": "Health Department", "description": "Healthcare services"},
                        {"id": "dept_education", "title": "Education Department", "description": "Schools and education"}
                    ]
                }]
            }
        })
        
        # 3. Grievance Description
        flow["nodes"].append({
            "id": f"grievance_description_{lang_code}",
            "type": "userInput",
            "position": {"x": 1550, "y": y_base + 50},
            "data": {
                "label": f"Grievance Description ({lang['name']})",
                "messageText": grv_data["desc_prompt"],
                "inputType": "text",
                "saveToField": "description",
                "validation": {
                    "required": True,
                    "minLength": 10,
                    "maxLength": 1000
                },
                "placeholder": "Describe your grievance"
            }
        })
        
        # 4. Location Option
        flow["nodes"].append({
            "id": f"location_option_{lang_code}",
            "type": "buttonMessage",
            "position": {"x": 1850, "y": y_base + 50},
            "data": {
                "label": f"Location Option ({lang['name']})",
                "messageText": grv_data["location_prompt"],
                "buttons": [
                    {"id": "skip_location", "text": "⏭️ Skip" if lang_code == "en" else ("छोड़ें" if lang_code == "hi" else "ଛାଡନ୍ତୁ"), "type": "quick_reply"},
                    {"id": "type_address", "text": "✍️ Type Address" if lang_code == "en" else ("पता टाइप करें" if lang_code == "hi" else "ଠିକଣା ଟାଇପ୍ କରନ୍ତୁ"), "type": "quick_reply"}
                ]
            }
        })
        
        # 5. Address Input
        flow["nodes"].append({
            "id": f"address_input_{lang_code}",
            "type": "userInput",
            "position": {"x": 2150, "y": y_base + 150},
            "data": {
                "label": f"Address Input ({lang['name']})",
                "messageText": grv_data["address_prompt"],
                "inputType": "text",
                "saveToField": "location.address",
                "validation": {"required": False},
                "placeholder": "Enter address"
            }
        })
        
        # 6. Media Upload
        flow["nodes"].append({
            "id": f"media_upload_{lang_code}",
            "type": "buttonMessage",
            "position": {"x": 2150, "y": y_base + 50},
            "data": {
                "label": f"Media Upload ({lang['name']})",
                "messageText": grv_data["media_prompt"],
                "buttons": [
                    {"id": "skip_media", "text": "⏭️ Skip" if lang_code == "en" else ("छोड़ें" if lang_code == "hi" else "ଛାଡନ୍ତୁ"), "type": "quick_reply"},
                    {"id": "upload_doc", "text": "📄 Upload" if lang_code == "en" else ("अपलोड करें" if lang_code == "hi" else "ଅପଲୋଡ୍ କରନ୍ତୁ"), "type": "quick_reply"}
                ]
            }
        })
        
        # 7. Confirmation
        flow["nodes"].append({
            "id": f"confirmation_{lang_code}",
            "type": "textMessage",
            "position": {"x": 2450, "y": y_base + 50},
            "data": {
                "label": f"Confirmation ({lang['name']})",
                "messageText": grv_data["confirmation"],
                "variables": ["citizenName", "departmentName", "description", "location.address", "media.length"]
            }
        })
        
        # 8. Submit Buttons
        flow["nodes"].append({
            "id": f"submit_buttons_{lang_code}",
            "type": "buttonMessage",
            "position": {"x": 2750, "y": y_base + 50},
            "data": {
                "label": f"Submit Buttons ({lang['name']})",
                "messageText": "Confirm?" if lang_code == "en" else ("पुष्टि करें?" if lang_code == "hi" else "ନିଶ୍ଚିତ କରନ୍ତୁ?"),
                "buttons": [
                    {"id": "confirm_submit", "text": "✅ Submit" if lang_code == "en" else ("जमा करें" if lang_code == "hi" else "ଦାଖଲ କରନ୍ତୁ"), "type": "quick_reply"},
                    {"id": "cancel_submit", "text": "❌ Cancel" if lang_code == "en" else ("रद्द करें" if lang_code == "hi" else "ବାତିଲ୍ କରନ୍ତୁ"), "type": "quick_reply"}
                ]
            }
        })
        
        # 9. Success Message
        flow["nodes"].append({
            "id": f"success_message_{lang_code}",
            "type": "textMessage",
            "position": {"x": 3050, "y": y_base + 50},
            "data": {
                "label": f"Success Message ({lang['name']})",
                "messageText": grv_data["success"],
                "variables": ["grievanceId"]
            }
        })
        
        # Add edges for grievance flow
        flow["edges"].extend([
            {"id": f"e{edge_counter}", "source": f"main_menu_{lang_code}", "target": f"citizen_name_{lang_code}", "sourceHandle": f"grv_{lang_code}", "label": "File Grievance"},
            {"id": f"e{edge_counter+1}", "source": f"citizen_name_{lang_code}", "target": f"department_selection_{lang_code}"},
            {"id": f"e{edge_counter+2}", "source": f"department_selection_{lang_code}", "target": f"grievance_description_{lang_code}"},
            {"id": f"e{edge_counter+3}", "source": f"grievance_description_{lang_code}", "target": f"location_option_{lang_code}"},
            {"id": f"e{edge_counter+4}", "source": f"location_option_{lang_code}", "target": f"media_upload_{lang_code}", "sourceHandle": "skip_location", "label": "Skip"},
            {"id": f"e{edge_counter+5}", "source": f"location_option_{lang_code}", "target": f"address_input_{lang_code}", "sourceHandle": "type_address", "label": "Type Address"},
            {"id": f"e{edge_counter+6}", "source": f"address_input_{lang_code}", "target": f"media_upload_{lang_code}"},
            {"id": f"e{edge_counter+7}", "source": f"media_upload_{lang_code}", "target": f"confirmation_{lang_code}", "sourceHandle": "skip_media", "label": "Skip"},
            {"id": f"e{edge_counter+8}", "source": f"confirmation_{lang_code}", "target": f"submit_buttons_{lang_code}"},
            {"id": f"e{edge_counter+9}", "source": f"submit_buttons_{lang_code}", "target": f"success_message_{lang_code}", "sourceHandle": "confirm_submit", "label": "Submit"}
        ])
        edge_counter += 10
    
    # End node
    flow["nodes"].append({
        "id": "end_node",
        "type": "end",
        "position": {"x": 3350, "y": 600},
        "data": {
            "label": "End",
            "endMessage": "Thank you!",
            "clearSession": True
        }
    })
    
    # Connect all success messages to end
    for lang in languages:
        flow["edges"].append({
            "id": f"e{edge_counter}",
            "source": f"success_message_{lang['code']}",
            "target": "end_node"
        })
        edge_counter += 1
    
    return flow

if __name__ == "__main__":
    flow = generate_flow()
    
    # Save to file
    output_file = "collectorate_jharsugda_complete_trilingual_flow.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(flow, f, indent=2, ensure_ascii=False)
    
    print(f"✅ Flow generated successfully!")
    print(f"📁 File: {output_file}")
    print(f"📊 Total Nodes: {len(flow['nodes'])}")
    print(f"🔗 Total Edges: {len(flow['edges'])}")
    print(f"🌐 Languages: English, Hindi, Odia")
