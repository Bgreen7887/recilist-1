var Todo = Backbone.Model.extend({
    defaults: function() {
      return {
	id: 0,
	title: 'defaultname',
	imgUrl: 'defaultimageurl',
        order: permStorage.nextOrder(),
        rating: 0,
        timeToMake: '',
        salty: 0,
        sour: 0,
        sweet: 0,
        bitter: 0,	
        taggedForList: false
      };
    },		
    initialize: function(){
      if( !this.get('ingrs') ){ 
        this.set({ingrs: new Array()});
      }
    }
});

var TodoList = Backbone.Collection.extend({
  model: Todo,
  //localStorage: new Backbone.LocalStorage("recilist-temp"),
  initialize: function() {
  },
  nextOrder: function() {
    if (!this.length) return 1;
    return this.last().get('order') + 1;
  },
  comparator: 'order',
  findRecipes: function(theQuery) {
    console.log("findRecipes called");
    searchTemp.reset(); //deletes the any old search results, they're not needed
    $.ajax({
      url: 'http://api.yummly.com/v1/api/recipes?_app_id=d8087d51&_app_key=005af5a16f1a8abf63660c2c784ab65f&maxResult=5&q='+theQuery,
      dataType: 'jsonp',
      success: function(apiStuff){
	var result = new Array();     
	result = apiStuff;          //saves the API's response as a new array
        result = result.matches;    //trims extra information from the json object, now only has information on the various recipes
	  
	$.each(result, function(i, item) {
	  var anotherRecipe= new Todo();    // makes a new model for each result
	  
	  anotherRecipe.set({
	    id: result[i].id,            //then sets the attributes
	    title: result[i].recipeName,	
	    ingrs: result[i].ingredients,
	    imgUrl: result[i].smallImageUrls,
            rating: result[i].rating,
            timeToMake: result[i].totalTimeInSeconds,
          });
          //not all recipes support flavor ratings, so error catching must be used to avoid setting null values
          try { anotherRecipe.set({ salty : result[i].flavors.salty }); } catch(e) {anotherRecipe.set({salty : "?"});}  //maybe replace the error condition to setting the flavor to '?'
          try { anotherRecipe.set({ sour: result[i].flavors.sour }); } catch(e) {anotherRecipe.set({sour : "?"});}
          try { anotherRecipe.set({ sweet: result[i].flavors.sweet }); } catch(e) {anotherRecipe.set({sweet : "?"});}
          try { anotherRecipe.set({ bitter: result[i].flavors.bitter }); } catch(e) {anotherRecipe.set({bitter : "?"});}

	  searchTemp.add(anotherRecipe);    //adds the model to the temporary     
	});
      }  //eventually, should add something that checks for an empty search result, appending some warning if that happens
    });
    console.log("search done");
  }  
});

var SavedList = Backbone.Collection.extend({
    model: Todo,
    localStorage: new Backbone.LocalStorage("permStorage"),

    initialize: function() {
        this.bind( 'add', this.saveModel, this );
    },
    taggedForList: function() {
      return this.where({taggedForList: true});
    },
    remaining: function() {
      return this.without.apply(this, this.taggedForList);
    },
    nextOrder: function() {
      if (!this.length) return 1;
      return this.last().get('order') + 1;
    },
    comparator: 'order',  
    saveModel: function(model, collection, options) {
        //model.save();
        //doesnt end up saving, it tries to get saved under tempSearch
    },
    /*
    save: function() {
        localStorage.setItem(this.model.id, JSON.stringify(this.model.data));
    }
    */
  /*
  returnAll: function() {
    return this.models
  }
  */
});

var ShopItem = Backbone.Model.extend({
    defaults: function() {
        return {
            ingr : 'ingredient',
            done : false
        }
    },
    toggle: function() {
      this.save({taggedForList: !this.get("taggedForList")}); 
    }
});

var ShopList = Backbone.Collection.extend({
    localStorage: new Backbone.LocalStorage("grocery-list"),
    getList: function() {
        var list = new Array();
        list = this.toJSON();
        return list;
    }
});
    
var Todos = new TodoList;	//I am afraid to move this, 95% sure its obsolete, though

var savedRecipesView = Backbone.View.extend({
    tagName:  "li",
    initialize: function() {
        this.render();
        this.listenTo(this.model, 'change', this.render);
        this.listenTo(this.model, 'destroy', this.remove);
    },
    render: function() {
        var template = _.template( $("#list_item").html(), {} );
        this.$el.html( template );
        /*
        this.$el.html(this.template(this.model.toJSON()));
        this.$el.toggleClass('done', this.model.get('done'));
        this.input = this.$('.edit');
        return this;
        */
    },
    events: {
        "click input[type=button]": "sendToGroceries"
    },
    sendToGroceries: function() {
        var temp = new Array();
        temp = this.toJSON();
        $.each(temp, function(i, item) {
            var shopItem = new ShopItem();    
            shopItem.set({ name: temp[i].title });
            shoppingList.add(shopItem);
            shopItem.save();
        });    
    }
});

window.HomeView = Backbone.View.extend({
    template:_.template($('#home').html()),
    
    render:function (eventName) {
        $(this.el).html(this.template());
        return this;
    }
});

window.newSearchView = Backbone.View.extend({
    template:_.template($('#newSearch').html()),
    //this VAGUELY works, but causes visual chaos the first run through,
    //still relies on the appending for that
    initialize: function() {
        console.log(searchTemp);
        //searchTemp.bind('searchDone', this.render, this);
        searchTemp.bind('add', this.render, this);
    },
    render:function (eventName) {
        var temp = new Array();  // I think this line isnt doing anyting
        results = searchTemp.toJSON();
        console.log(results);
        var variables = {
            recipes: results
        };
        $(this.el).html(this.template());
        return this;
    },
    events: {
      "keypress #recipe-search":  "searchOnEnter",
      //add a listener to newSearch to change what's displaye don this list
    },
    searchOnEnter: function(e) {   //the search bar's functionality
      if (e.keyCode != 13) return;
      var searchin = $("input[id='recipe-search']").val();
      
      console.log("searched for - "+ searchin);
      //this function is in todoList, does an API call and
      //adds a new model for each result (there will almost always be 5 results)
      searchTemp.findRecipes(searchin);
    }
});

window.newListView = Backbone.View.extend({
    template : _.template($('#newList').html()),
    initialize: function() {
    },
    render:function (eventName) {
        recipe = this.model.toJSON(); ///INCOMPLETE, modify newlist to accept straight from JSON
	var variables = {
            recipe_name : this.model.get("title"),
            img_url : this.model.get("imgUrl"),
            timetomake: this.model.get("timeToMake"),
            ingrs : this.model.get("ingrs"),
            rating : this.model.get("rating"),
            salty : this.model.get("salty"),
            sour : this.model.get("sour"),
            sweet : this.model.get("sweet"),
            bitter : this.model.get("bitter")
        };
        $(this.el).html(this.template(variables));
        return this;
    },
    events: {
      "click #save-this":  "saveModel"
    },
    saveModel: function() {
	console.log("saveModel() called");
	//console.log(permStorage.taggedForList());
        //shift the model over to permStorage
        //searchTemp.remove(this.model);
        console.log(this.model);
        var tempModel= new Todo();
        tempModel=this.model;
        permStorage.add(tempModel);
        console.log("current state of permStorage: ");
        console.log(permStorage.models);
        //now save permStorage to local storage
        permStorage.each(function (recipe) { recipe.save(); });
        
    }
});

window.savedRecipesView = Backbone.View.extend({
    //collection: Backbone.Collection.extend(),
    //so this isnt really associated with any particular collection- how do we fix that?
    template:_.template($('#savedRecipes').html()),
    initialize: function() {
        _.bindAll(this, 'render', 'addOne');
        //this.collection.bind('add', this.addOne);
        //this.collection.bind('reset', this.render);
        permStorage.bind('add', this.addOne);
        permStorage.bind('reset', this.render);
        console.log(permStorage);
    },
    render:function (data) {    
        $(this.el).html(this.template());
        _.each(data, function(task) {
            console.log("meow");
            this.addOne(task);
        }, this);
        return this;
    },
    addOne: function(task) {
        var view = new listItemView({ model:task });
        $(this.el).append( view.render().el );
    }
});

window.listItemView = Backbone.View.extend({
    tagName: 'li',
    template:_.template($('#list-item').html()),
    initialize: function() {
        _.bindAll(this, 'render');
        this.model.bind('change', this.render);
        this.model.view = this;
    },
    events: {
        "click input[type=button]" : "onClick"
    },
    render: function() {
        $(this.el).html(this.template(this.model.toJSON()));
        this.setContent();
        return this;
    },
    onClick: function(){
        permStorage.add(this.model);
        console.log("model added to permStorage, current state of permStorage:");
        console.log(permStorage);
    }
});

window.oldListView = Backbone.View.extend({
    template:_.template($('#oldList').html()), 
    render: function (eventName) {
        $(this.el).html(this.template());
        return this;
    }
});    
   
window.deleteOldView =  Backbone.View.extend({
    template:_.template($('#deleteOld').html()), 
    render: function (eventName) {
        $(this.el).html(this.template());
        return this;
    }
}); 
    
var AppRouter = Backbone.Router.extend({
    routes:{
        "":"home",
        "newSearch":"newSearch",
        "newList/:id":"newList",
        "savedRecipes":"savedRecipes",
        "oldList":"oldList",
	"deleteOld":"deleteOld"
    },
    initialize:function () {
        // Handle back button throughout the application
        $('.back').live('click', function(event) {
            window.history.back();
            return false;
        });
        this.firstPage = true;
    },
    home:function () {
        this.changePage(new HomeView());
    },
    newSearch:function () {
        this.changePage(new newSearchView());
    },
    newList:function (theID) {
        var tempModel = searchTemp.get(theID);
        this.changePage(new newListView({
            model: tempModel,
            id: theID
        }));
        //console.log(permStorage.taggedForList());
    },
    savedRecipes:function () {  
        this.changePage(new savedRecipesView());      
    },
    oldList:function () {
        this.changePage(new oldListView());
    },
    deleteOld:function () {
        this.changePage(new deleteOldView());
    },
    changePage:function (page) {
        $(page.el).attr('data-role', 'page');
        page.render();
        $('body').append($(page.el));
        var transition = $.mobile.defaultPageTransition;
        // We don't want to slide the first page
        if (this.firstPage) {
            transition = 'none';
            this.firstPage = false;
        }
        $.mobile.changePage($(page.el), {changeHash:false, transition: transition});
    }

});

$(document).ready(function () {
    console.log('document ready');
    app = new AppRouter();
    Backbone.history.start();
    searchTemp = new TodoList(); //this stores searched recipes
    permStorage = new SavedList();
});