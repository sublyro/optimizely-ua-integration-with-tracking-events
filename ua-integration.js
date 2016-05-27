window.integration = {
  /**
   * This function sets a custom variable on Google Analytics for every experiment
   * that is active on this page.The function is called for all active experiments,
   * including any redirect experiments that might have been running on a previous
   * page.
   *
   * @param {string} experimentId
   * @param {Array<string>} variationIds
   */
  makeRequest: function(experimentId, variationId) {
    var experimentName = optimizely.data.experiments[experimentId].name;
    var variationName = optimizely.data.state.variationNamesMap[experimentId];

    experimentName = experimentName.replace(new RegExp(" ", 'g'), "_");
    variationName = variationName.replace(new RegExp(" ", 'g'), "_");

    var normalisedName = 'Optimizely_' +experimentName +' (' +experimentId +'): ' +variationName;
        
    var itv = setInterval(function() {
      if (window.ga && typeof window.ga === 'function') {

        clearInterval(itv);
          if (optimizely.allExperiments[experimentId] && optimizely.allExperiments[experimentId].universal_analytics && optimizely.allExperiments[experimentId].universal_analytics.slot) {
            var slot = optimizely.allExperiments[experimentId].universal_analytics.slot;
            var param = {};
            param['nonInteraction'] = 1;
            param['hitCallback'] = window.optly.UAEventTrackingCallback;
            param['dimension' +slot] = normalisedName;
            //window.ga('send', 'event', 'optimizely', experimentId +" " +experimentName, variationName, {'nonInteraction': 1, slot: this.normaliseOptimizelyDimensionName(experimentName, experimentId, variationName), 'hitCallback': window.optly.UAEventTrackingCallback});
            window.ga('send', 'event', 'optimizely', experimentId +" " +experimentName, variationName, param);
          } else {
            console.log("making request to GA");
            window.ga('send', 'event', 'optimizely', experimentId +" " +experimentName, variationName, {'nonInteraction': 1, 'hitCallback': window.optly.UAEventTrackingCallback });
          }
          window.optimizely.push(["trackEvent", "ga_tracking"]);
            
      }   
     }, 50);
  },

  /**
   * This function is only called once for every page.
   * Use that to setup the listener on non-immediate experiments 
   * and fix the referrer in redirect experiments
   */
  initialize: function() {
    // in case of redirect experiment we might want to fix the referrer value sent to the analytics platform
    if (optimizely.data.state.redirectExperiment !== undefined) {
      this.fixReferrer();
    }

    // listen for experiments that might get activated later
    this.waitForManualAndConditionalExperiments();
  },
  finish: function() {
    // Nothing to do here for the UA integration
  },
  fixReferrer: function() {
    if (optimizely.data.state.redirectExperiment && optimizely.data.state.redirectExperiment.referrer) {
      
      var itv = setInterval(function() {
      if (window.ga && typeof window.ga === 'function') {
            window.ga('set', 'referrer', optimizely.data.state.redirectExperiment.referrer);
            clearInterval(itv);
      }   
     }, 50);
      
       
    }
  },
  /**
   * Check if any manual or conditional experiments are enabled
   * if so then wait for them to get activated
   */
  waitForManualAndConditionalExperiments: function() {

    var possibleExperiments = [];
    
    var diff = function(a1, a2) {
      var d = [];
      for (var i = 0; i < a2.length; i++) {
        if (a1.indexOf(a2[i]) === -1) {
          d.push(a2[i]);
        }
      }
      return d;
    };

    var matchURL = function(url1, url2) {
      return simpleMatch(url1, url2) || exactMatch(url1, url2) || substringMatch(url1, url2) || regexMatch(url1, url2);
    };

    var simpleMatch = function(url1, url2) {
      url1 = url1.replace("http://", "").replace("https://", "").replace("www.", "");
      url1 = url1.indexOf('?') > -1 ? url1.substring(0, url1.indexOf('?')) : url1;
      url1 = url1.lastIndexOf('/') == (url1.length - 1) ? url1.substring(0, url1.lastIndexOf('/')) : url1;
      url2 = url2.replace("http://", "").replace("https://", "").replace("www.", "");
      url2 = url2.indexOf('?') > -1 ? url2.substring(0, url2.indexOf('?')) : url2;
      url2 = url2.lastIndexOf('/') == (url2.length - 1) ? url2.substring(0, url2.lastIndexOf('/')) : url2;
      return url1 == url2;
    };

    var exactMatch = function(url1, url2) {
      url1 = url1.replace("http://", "").replace("https://", "");
      url1 = url1.lastIndexOf('/') == (url1.length - 1) ? url1.substring(0, url1.lastIndexOf('/')) : url1;
      url2 = url2.replace("http://", "").replace("https://", "");
      url2 = url2.lastIndexOf('/') == (url2.length - 1) ? url2.substring(0, url2.lastIndexOf('/')) : url2;
      return url1 == url2;
    };

    var substringMatch = function(url1, url2) {
      return url1.indexOf(url2) != -1;
    };

    var regexMatch = function(url1, url2) {
      return url1.match(url2) !== null;
    };

    // Check what experiments might still get activated in that page
    for (var id in optimizely.allExperiments) {
      var experiment = optimizely.allExperiments[id];
      if (optimizely.activeExperiments.indexOf(id) == -1 && experiment.enabled === true && experiment.activation_mode && (experiment.activation_mode == 'manual' || experiment.activation_mode == 'conditional')) {
        var page = document.URL;
        for (var i = 0; i < experiment.urls.length; i++) {
          var pageURL = experiment.urls[i];
          if (matchURL(page, pageURL.value)) {
            possibleExperiments.push(id);
            break;
          }
        }
      }
    }

    // check if manual or conditional experiments have been started 
    var oldActiveExperiments = optimizely.activeExperiments.slice();
    var integrationItv = setInterval(function() {
      if (optimizely.activeExperiments.length > oldActiveExperiments.length) {
        var newExperiments = diff(oldActiveExperiments, optimizely.activeExperiments);
        oldActiveExperiments = optimizely.activeExperiments.slice();
        for (var i = 0; i < newExperiments.length; i++) {
          var experimentId = newExperiments[i];
          window.integration.makeRequest(experimentId, optimizely.data.state.variationIdsMap[experimentId]);
          possibleExperiments.pop(id);
        }
      }

      // poll until everything that can be activated has been activated
      if (possibleExperiments.length < 1) {
        clearInterval(integrationItv);
      }
    }, 100); 
  }
};


window.optly.UAEventTrackingCallback = function() { window.optimizely.push(["trackEvent", "ga_tracking_callback"]); };


var loadScript = function(location, callback){
   var fileRef = document.createElement('script');
   fileRef.setAttribute('type','text/javascript');

   if (callback) {
     if (fileRef.readyState) {  // IE
       fileRef.onreadystatechange = function() {
         if (fileRef.readyState == 'loaded' || fileRef.readyState == 'complete') {
           fileRef.onreadystatechange = null;
           callback();
         }
       };
     } else {  // Non-IE
       fileRef.onload = function(){
         callback();
       };
     }
   }

   fileRef.setAttribute('src', location);
   document.head.appendChild(fileRef);
 };

 loadScript('https://cdn.rawgit.com/optimizely/Analytics-JS/master/integrator.js', function() {
   // Register the integration as soon as the integrator is initialised
  var analyticsItv = setInterval(function() {
    if (window.integrator) {
      console.log("Framework is ready");
      window.integrator.registerIntegration(window.integration);
      clearInterval(analyticsItv);
    }
  }, 50);
 });