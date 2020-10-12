//adapted from the cerner smart on fhir guide. updated to utalize client.js v2 library and FHIR R4

//create a fhir client based on the sandbox enviroment and test paitnet.
const client = new FHIR.client({
  serverUrl: "https://r4.smarthealthit.org",
  tokenResponse: {
    patient: "a6889c6d-6915-4fac-9d2f-fc6c42b3a82e"

      //https://launch.smarthealthit.org/v/r4/fhir/Patient/351502fd-c732-4be7-8f90-64bb707ec721//
  }
});

// helper function to process fhir resource to get the patient name.
function getPatientName(pt) {
  if (pt.name) {
    var names = pt.name.map(function(name) {
      return name.given.join(" ") + " " + name.family;
    });
    return names.join(" / ")
  } else {
    return "anonymous";
  }
}

// display the patient name gender and dob in the index page
function displayPatient(pt) {
  document.getElementById('patient_name').innerHTML = getPatientName(pt);
  document.getElementById('gender').innerHTML = pt.gender;
  document.getElementById('dob').innerHTML = pt.birthDate;
  document.getElementById('age').innerHTML = getAge(pt.birthDate) + ' years old';
}

function getAge(birthDate) {
    var dob = new Date(birthDate);
    var today = new Date();
    var age = Math.floor((today-dob) / (365.25 * 24 * 60 * 60 *1000));
    return age;
}

//function to display list of medications
function displayMedication(meds) {
  med_list.innerHTML += "<li> " + meds + "</li>";
}

//helper function to get quanity and unit from an observation resoruce.
function getQuantityValueAndUnit(ob) {
  if (typeof ob != 'undefined' &&
    typeof ob.valueQuantity != 'undefined' &&
    typeof ob.valueQuantity.value != 'undefined' &&
    typeof ob.valueQuantity.unit != 'undefined') {
    return Number(parseFloat((ob.valueQuantity.value)).toFixed(2)) + ' ' + ob.valueQuantity.unit;
  } else {
    return undefined;
  }
}

function getTextValues(ob) {
    if (typeof ob != null &&
        typeof ob != 'undefined' &&
        typeof ob.valueCodeableConcept != 'undefined' &&
        typeof ob.valueCodeableConcept.text != 'undefined') {
        return ob.valueCodeableConcept.text.display
    } else {
        return undefined;
    }
}

// helper function to get both systolic and diastolic bp
function getBloodPressureValue(BPObservations, typeOfPressure) {
  var formattedBPObservations = [];
  BPObservations.forEach(function(observation) {
    var BP = observation.component.find(function(component) {
      return component.code.coding.find(function(coding) {
        return coding.code == typeOfPressure;
      });
    });
    if (BP) {
      observation.valueQuantity = BP.valueQuantity;
      formattedBPObservations.push(observation);
    }
  });

  return getQuantityValueAndUnit(formattedBPObservations[0]);
}

// create a patient object to initalize the patient
function defaultPatient() {
  return {
    height: {
      value: ''
    },
    weight: {
      value: ''
    },
    sys: {
      value: ''
    },
    dia: {
      value: ''
    },
    brcatest: {
      value: ''
    },
    breastcancerrisk: {
      value: ''
    },
  };
}

//helper function to display the annotation on the index page
function displayAnnotation(annotation) {
  note.innerHTML = annotation;
}

//function to display the observation values you will need to update this
function displayObservation(obs) {
    sys.innerHTML = obs.sys;
    dia.innerHTML = obs.dia;
    weight.innerHTML = obs.weight;
    height.innerHTML = obs.height;

    brcatest.innerHTML = obs.brcatest;
    breastcancerrisk.innerHTML = obs.breastcancerrisk;
}

// get patient object and then display its demographics info in the banner
client.request(`Patient/${client.patient.id}`).then(
  function(patient) {
    displayPatient(patient);
    console.log(patient);
  }
);

// get observation resoruce values
// you will need to update the below to retrive the weight and height values
var query = new URLSearchParams();

query.set("patient", client.patient.id);
query.set("_count", 100);
query.set("_sort", "-date");
query.set("code", [
    'http://loinc.org|8462-4',
    'http://loinc.org|8480-6',
    'http://loinc.org|2085-9',
    'http://loinc.org|2089-1',
    'http://loinc.org|55284-4',
    'http://loinc.org|3141-9',
    'http://loinc.org|8302-2',
    'http://loinc.org|29463-7',
    'http://loinc.org|59041-4', //BRCA1+BRCA2 gene mutations tested for//
].join(","));

client.request("Observation?" + query, {
  pageLimit: 0,
  flat: true
}).then(
  function(ob) {

    // group all of the observation resoruces by type into their own
    var byCodes = client.byCodes(ob, 'code');
    var systolicbp = getBloodPressureValue(byCodes('55284-4'), '8480-6');
    var diastolicbp = getBloodPressureValue(byCodes('55284-4'), '8462-4');

    var weight = byCodes('29463-7');
    var height = byCodes('8302-2');


    // create patient object
    var p = defaultPatient();

    // set patient value parameters to the data pulled from the observation resoruce
    if (typeof systolicbp != 'undefined') {
      p.sys = systolicbp;
    } else {
      p.sys = 'undefined'
    }

    if (typeof diastolicbp != 'undefined') {
      p.dia = diastolicbp;
    } else {
      p.dia = 'undefined'
    }

    p.height = getQuantityValueAndUnit(height[0]);
    p.weight = getQuantityValueAndUnit(weight[0]);

    displayObservation(p)

  });


function getMedicationName(medCodings) {
  var coding = medCodings.find(function(c){
    return c.system == "http://www.nlm.nih.gov/research/umls/rxnorm";
  });
  return coding && coding.display || "Unnamed Medication(TM)";
}

client.request("/MedicationRequest?patient=" + client.patient.id, {
  resolveReferences: [ "medicationReference" ],
  graph: true
})

    // Reject if no MedicationRequests are found
    .then(function(data) {
      if (!data.entry || !data.entry.length) {
        throw new Error("No medications found for the selected patient");
      }
      return data.entry;
    })

    // Build an array of medication names
    .then(function(entries) {
      entries.map(function(meds) {
        displayMedication(getMedicationName(
            client.getPath(meds, "resource.medicationCodeableConcept.coding") ||
            client.getPath(meds, "resource.medicationReference.code.coding")
        ));
      });

    })

//update function to take in text input from the app and add the note for the latest weight observation annotation
//you should include text and the author can be set to anything of your choice. keep in mind that this data will
// be posted to a public sandbox

//event listner when the add button is clicked to call the function that will add the note to the weight observation
var newQuery = new URLSearchParams();
var fhstatus;
var teststatus;
newQuery.set("patient", client.patient.id);
newQuery.set("_count", 100);
newQuery.set("_sort", "-date");
newQuery.set("code", 'http://loinc.org|59041-4');

function getFamilyHistory(){
    client.request("/FamilyMemberHistory?" + newQuery,
    ).then(function(fmh) {
        console.log(fmh)
        if (fmh.entry[0].resource.finding) {
            document.getElementById("fmh").innerHTML = fmh.entry[0].resource.finding;
            if (fmh.entry[0].resource.finding.toLowerCase().includes("normal")) {
                fhstatus = "No";
            } else{
                fhstatus = "Yes";
            }
        } else {
            document.getElementById("fmh").innerHTML = "eg. \"No Family History data\"";
            fhstatus = "Not done";
        }
        return fhstatus;})
}

function getBRCAtest(){
    client.request("/Observation?" + newQuery,
    ).then(function(brcatest){
        console.log(brcatest);
        var p = defaultPatient();
        p.brcatest = getTextValues(brcatest[0]);
        document.getElementById("brcatest").innerHTML = p.brcatest;
        if (typeof brcatest[0] != 'undefined'){
            if (p.brcatest.toLowerCase().includes("normal")){
                teststatus = "Normal" ;
            }
            else{
                teststatus = "Abnormal";
            }
        } else{
            teststatus = "Not done";
        }
        return teststatus;
        })
}


function riskEvaluation(){
    var p = defaultPatient();
    if (getAge(p.birthDate)< 50 && getBRCAtest() === "Normal" && getFamilyHistory() === "No"){
        p.breastcancerrisk = "Low risk";
    }else if (getAge(p.birthDate)> 50 && getBRCAtest() === "Abnormal" && getFamilyHistory() === "Yes"){
        p.breastcancerrisk = "High risk";
    }
    else {p.breastcancerrisk = "Medium risk"}
    document.getElementById("breastcancerrisk").innerHTML = p.breastcancerrisk;
}