/*
* Implementation of Facade methods of HBTree
*/

/* 
* Receives as a parmaeter a game/system entity, a scene node which is being evaluated
* Returns a vec3 with the position
*/
Facade.prototype.getEntityPosition = function( entity )
{
	entity.transform.position;
}

//For the HBTProperty Node
/*
* Search in all the properties (scene and entity) one with the name passed as a parameter
* Returns the value of the property (int, float or vec3) 
*/
Facade.prototype.getEntityPropertyValue = function( property_name, entity )
{	
	var my_comp = null;
	var components = entity._components;
	for(var i in components)
	{
		if(components[i].constructor.name == "HBTreeController")
			my_comp = components[i];
	}
    if(!my_comp)
    {
        my_comp = {};
        my_comp.local_properties = entity.properties;
    }
	return my_comp.local_properties[property_name];
	//Search for the value of the property "property_name" in the system
}

//For the SimpleAnimate Node
/*
* Return the existing types of interest points
*/
Facade.prototype.getAnimation = function( path )
{
	if(typeof LS == "undefined")
		return path;
	var anim = LS.ResourcesManager.getResource( path );
	if(anim)
		return anim.filename;
	else
		return path;
	//debugger;
	//console.warn("entityInTarget() Must be implemented to use HBTree system");
}

//For the ActionAnimate Node
/*
* Return the time of an animation
*/
Facade.prototype.getAnimationDuration = function( path )
{
	var anim = LS.ResourcesManager.getResource( path );
	if(anim)
		return anim.takes.default.duration;
	else
		return false;
}

//For the EQSNearestInterestPoint Node
/*
* Return all the existing interest points
*/
Facade.prototype.getInterestPoints = function(  )
{
	console.warn("entityInTarget() Must be implemented to use HBTree system");
}
/*
* @entity: the virtual entity evaluated. The type you are using as an entity 
* @look_at_pos: vec3 with the target position to check if it's seen or not 
* @limit_angle: a number in degrees (field of view)
*/
Facade.prototype.canSeeElement = function( entity, look_at_pos, limit_angle)
{
	console.warn("entityInTarget() Must be implemented to use HBTree system");
}

Facade.prototype.setEntityProperty = function( entity, property, value )
{
	var my_comp = null;
	var components = entity._components;
	for(var i in components)
	{
		if(components[i].constructor.name == "HBTreeController")
			my_comp = components[i];
	}
    if(!my_comp)
    {
        my_comp = {};
        my_comp.local_properties = entity.properties;
    }
	my_comp.local_properties[property] = value;
	if(entity.inspector)
		entity.inspector.refresh()
	console.warn("entityInTarget() Must be implemented to use HBTree system");
}


//Not implemented:
//Facade.prototype.getListOfAgents
//Facade.prototype.entityInTarget
//Facade.prototype.checkNextTarget
//Facade.prototype.entityHasProperty
