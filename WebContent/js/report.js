// Process report files
// Part of HOPSA visualization module.
// To be used with report_lib.js.


// List of all processed requests
var processed_requests = new Array();

// Time inetrval for all (line) charts. Used in JD.
var start_time = null;
var end_time = null;
var margin_time = 2; // sec

$(document).ready(function() 
{
	maketoggable = true;
// baseURL - base path for accessing query descriptions in Google Docs. 
	var prop = $('div#baseURL').attr('baseURL');
// Default baseURL is set in this file. To redefine set it in <div id='baseURL' baseURL='...'> tag in report template,
// or in baseURL attribute inside any <request> tag. 
	if (prop != undefined) {
		baseURL = prop;
	}
	
	
// Check start and end time in report template HTML file
// If tags with <.. id="start_time"> and <.. id="end_time"> exist and are not empty, set start end end time for xAxis
	var start_elm = $("#start_time");
	if (start_elm.length > 0 && $("#end_time").length > 0) {
		start_time = time4axis(parseInt($("#start_time").text()) - margin_time);
		end_time = time4axis(parseInt($("#end_time").text()) + margin_time);
	}
	
// Initialize with correct values for timeofday-typed x-axis charts
	if (start_time != null) {
		var start_date = new Date(start_time);
		var localOffset = start_date.getTimezoneOffset() * 60000;
		var UTC_start = new Date(start_date.getTime() + localOffset);
		year_dummy = UTC_start.getFullYear();
		month_dummy = UTC_start.getMonth();
		day_dummy = UTC_start.getDate();
	}	
	
// "Toggability" - attribute of charts that can be slide-opened and slide-closed. Toggable charts are initially closed.
// To toggle chart use <h3> title before <div class='toggable> tag. These <h3> titles will be rendered as buttons that toggle visablility of the <div>.	
	if (maketoggable) {
// Next to <h1> title there will be rendered an "expand all" button.		
		$("h1").before('<input type="button" onClick="expandAll()" value="expand all" class="expandButton" />');
		$("div.toggable").each( function (i) {
// For each div.toggable tag add <h3> title before if not exists.										  
			var prev_h3 = $(this).prev("h3");
			if (prev_h3.length == 0) {
				$(this).before('<h3>'+defaultToggleButtonSign($(this))+'</h3>');
			}
		});
// Add class 'toggable' to <h3>.		
		$("div.toggable").prev("h3").addClass("toggable");
// Add event handler on click to <h3> to slide-open the next <div> tag.
		$("h3.toggable").click(function() {
			toggle($(this));
			$(this).next("div").slideToggle('slow');
			return false;
		});
// For all not Number charts set min-height (in CSS class "request_diagramm").	
		$('request').not('[chart="Number"]').addClass("request_diagramm");
		$("request").each( function(i) {		
// Now process all requests that do not have <div class="toggable"> before them.
			var div_parents = $(this).parents("div.toggable").length;
			if (div_parents < 1) processRequest($(this));
		});
	} else {
		$("request").each( function(i) {
			processRequest($(this));
		});
	}		
});

function expandAll() {
	$('h3.toggable').each( function(i) {
		expand($(this));
	});
}

function expand(h_elm) {
	if (!isOpened(h_elm)) {
		jQuery(h_elm).next("div").find("request").each( function(i) {							
			processRequest($(this));
		});	
		jQuery(h_elm).next("div").slideDown('slow');	
	}
}

function toggle(h_elm) {
	if (!isOpened(h_elm)) {
		jQuery(h_elm).next("div").find("request").each( function(i) {				
			processRequest($(this));
		});				
	}
}

function reprocessRequest(id) {
	var request_elm = $("request#"+id);
	var step= jQuery(request_elm).attr("step");
	if (step==null || step == 'false') {
		jQuery(request_elm).attr("step","true");
	} else {
		jQuery(request_elm).attr("step","false");
	}
	//$("div#"+id).remove();
	$("h4#h4_"+id).remove();
	
// remove id form list of processed requests	
	var request_index = processed_requests.indexOf(id);
	if (request_index >= 0) processed_requests.splice(request_index,1);
	
	processRequest(id);
}


/*
 * Process request tag options and prepare options for rendering chart: c_options,
 */
function processRequest(request_elm) 
{
	var id = null;
	if (request_elm.attr) { 
		id = request_elm.attr("id");
	}
	if (id == null || id === "undefined") {
		id = request_elm;		
		request_elm = $("request#"+id);
	}
	
// check if id in list of processed requests	
	if (processed_requests.indexOf(id) >= 0) return;
	processed_requests.push(id);

	var filename = "/avroconnect/"+$("request#"+id).attr("file");
	
	var div_elm = $("div#"+id);
	if (div_elm == null || div_elm.length < 1) {
		jQuery(request_elm).before("<div id=\""+id+"\" title=\""+jQuery(request_elm).attr("title")+"\">");
		jQuery(request_elm).after("</div>");
	}
	
	// reference to description in Google Docs	
	if (jQuery(request_elm).attr("baseURL")!=null) {
		baseURL = jQuery(request_elm).attr("baseURL");
	}
	else jQuery(request_elm).attr("baseURL",baseURL);
	
	$.ajax({
		url: filename,		
		statusCode: {
			404: function() {
				$("#"+id).html("<div class='empty'>No data file</div>");
			}
		},
		success: function(data) {
			data = stripQuotes(data);			
			var volume_of_data = getVolume(data);  // Get measure of data, presently - number of lines. May change later. 
			
			var file = filename.substring(filename.lastIndexOf("/")+1);
			var txtfilename = file;
			if (file.indexOf("~") > 0 ) txtfilename = file.substring(0,file.indexOf("~"));
			var URL = document.URL;
			URL = URL.substring(0,URL.lastIndexOf("/")+1);			
			
			if (data.length < 1) {
				if (jQuery(request_elm).attr("short")==null) { 
					var h4id = create_headers(id,"<a href=\""+URL+file+"\" target=\"_blank\" title='open CSV file \""+file+"\"'>"+txtfilename+"</a>");
					$("#"+h4id).addClass("filename");
				}

				$("#"+id).html("<div class='empty'>No data</div>");
				hideElement(request_elm);
				return;
			} else {
				if (jQuery(request_elm).attr("short")==null) { 
// Check if headers exist. Headers sample:  top_users_CPU_time   [SOURCE]   [DESCR]   00:02:09.348/00:00:00.2
					var headers = $("#"+id).prev("h4.filename");
					if ( headers.length == 0) {
// Add headers if not exist.				
						$("#"+id).before(requestInfoHeader(request_elm, filename,volume_of_data));
					}			
				}
			}
			if (data.indexOf("--") == 0) {
				message = format_error_reply(data);
				$("#"+id).html("<div class='error'>"+message+"</div>");
				hideElement(request_elm);
				return;
			}			
			var custom_pars = new Array();
			//For JD: 
			//custom_pars = [{name:"chart", value:{marginBottom:80}},{name:"legend", value:{y:0}}, {name:"xAxis",value:{gridLineWidth:1, gridLineColor:"#DFDFDF"}}];
			
			// Check start and end time in report template HTML file
			// If tags with <.. id="start_time"> and <.. id="end_time"> exist and are not empty, set start end end time for xAxis
			//if (start_time != null) custom_pars.push({name:"xAxis",value:{min:start_time}});
			//if (end_time != null) custom_pars.push({name:"xAxis",value:{max:end_time}});
				
			
			setOptions(request_elm,custom_pars,data);			
		},
		mimeType: "text/csv",
		dataType: "text"
	});			
}


