var UTILS = {

    arrayToString: function(array)
    {
        var str = "";
        for(var i = 0; i < array.length; i++)
            str += String.fromCharCode(array[i]);
        return str;
    },

    rand : function() {
      return Math.random().toString(36).substr(2); // remove `0.`
    },
    
    getFileExtension(filename) {

        var tkn = filename.split(".");
        return tkn.pop().toLowerCase();
    },

    replaceAll(str, find, replace) {
        return str.replace(new RegExp(find, 'g'), replace);
    },
    
    includes(str, find)
    {
        find = [].concat(find);
    
        for(var i = 0; i < find.length; i++)
            if( str.toLowerCase().includes(find[i]) )
                return true;
    }
}
