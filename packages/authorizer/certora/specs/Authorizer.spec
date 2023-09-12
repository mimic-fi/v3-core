import "./General.spec";

using Helpers as helpers;

methods {
    // Helpers
    function helpers.authParams(address,address,bytes4) external returns (uint256[]) envfree;

    // Authorizer
    function ANYONE() external returns (address) envfree => ALWAYS(0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF);
    function ANYWHERE() external returns (address) envfree => ALWAYS(0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF);
    function hasPermissions(address,address) external returns (bool) envfree;
    function isAuthorized(address,address,bytes4,uint256[]) external returns (bool) envfree;
    function hasPermission(address who, address where, bytes4 what) external returns (bool) envfree;
    function getPermissionParams(address,address,bytes4) external returns (IAuthorizer.Param[]) envfree;
}

definition INITIALIZE() returns uint8 = 0;
definition AUTHORIZE() returns uint8 = 1;
definition UNAUTHORIZE() returns uint8 = 2;
definition CHANGE_PERMISSIONS() returns uint8 = 3;

definition getSelector(uint8 f) returns uint32 = (
    f == INITIALIZE() ?
        sig:initialize(address[]).selector : (
    f == AUTHORIZE() ? 
        sig:authorize(address, address, bytes4, IAuthorizer.Param[]).selector : (
    f == UNAUTHORIZE() ?
        sig:unauthorize(address, address, bytes4).selector : (
    f == CHANGE_PERMISSIONS() ?
        sig:changePermissions(IAuthorizer.PermissionChange[]).selector : 0
    )))
);

function isValidPermissionsState(address who, address where, bytes4 what) returns bool {
    bool hasPermission = hasPermission(who, where, what);
    IAuthorizer.Param[] params = getPermissionParams(who, where, what);

    bool ifNoPermissionsThenNotAuthorized = !hasPermissions(who, where) => !hasPermission;
    bool ifNotAuthorizedThenNoParams = !hasPermission => params.length == 0;

    return ifNoPermissionsThenNotAuthorized && ifNotAuthorizedThenNoParams;
}

invariant validPermissionsState(address who, address where)
    forall bytes4 what . !hasPermissions(who, where) => !hasPermission(who, where, what);

use rule sanity;

use rule reentrancyGuard filtered {
    f -> 
        !f.isView
        && f.selector != getSelector(CHANGE_PERMISSIONS())
        && f.selector != getSelector(INITIALIZE())
}

rule senderMustBeAuthorizedToAuthorizeOthers(env e, address who, address where, bytes4 what, IAuthorizer.Param[] params)
    good_description "Only authorized users can authorize other users"
{
    bytes4 sigAuthorize = to_bytes4(getSelector(AUTHORIZE()));
    uint256[] how = helpers.authParams(who, where, what);
    bool senderCanAuthorize = isAuthorized(e.msg.sender, currentContract, sigAuthorize, how);

    authorize(e, who, where, what, params);

    assert senderCanAuthorize;
}

rule senderMustBeAuthorizedToUnauthorizeOthers(env e, address who, address where, bytes4 what)
    good_description "Only authorized users can unauthorize other users"
{
    bytes4 sigAuthorize = to_bytes4(getSelector(UNAUTHORIZE()));
    uint256[] how = helpers.authParams(who, where, what);
    bool senderCanUnauthorize = isAuthorized(e.msg.sender, currentContract, sigAuthorize, how);

    unauthorize(e, who, where, what);

    assert senderCanUnauthorize;
}

rule otherFunctionsCannotAuthorize(env e, method f, calldataarg args, address who, address where, bytes4 what)
    filtered {
        f -> 
            !f.isView
            && f.selector != getSelector(AUTHORIZE())
            && f.selector != getSelector(CHANGE_PERMISSIONS())
            && f.selector != getSelector(INITIALIZE())
    }
    good_description "Permissions can only be granted by authorize or changePermissions functions"
{
    uint256[] how = helpers.authParams(who, where, what);
    bool authorizedBefore = isAuthorized(who, where, what, how);

    f(e, args);

    bool authorizedAfter = isAuthorized(who, where, what, how);

    assert !authorizedBefore => !authorizedAfter;
}

rule unauthorizeAfterAuthorizeShouldNotChangeStorage
    (env e, address who, address where, bytes4 what, IAuthorizer.Param[] params)
    good_description "Doing authorize and then unauthorize shouldn't change the storage"
{
    require params.length == 0 && ghostReentrancyStatus == 1;

    uint256[] how = helpers.authParams(who, where, what);
    require !isAuthorized(who, where, what, how);
    IAuthorizer.Param[] permissionParams = getPermissionParams(who, where, what);
    require permissionParams.length == 0; // TODO: write an invariant for this

    storage initStorage = lastStorage;

    authorize(e, who, where, what, params);
    unauthorize(e, who, where, what);

    storage currentStorage = lastStorage;

    assert initStorage[currentContract] == currentStorage[currentContract];
}

rule authorizeWorksProperly(env e, address who, address where, bytes4 what, IAuthorizer.Param[] params, address where2, bytes4 what2)
    good_description "For someone without permissions, if we call authorize to do `what` on `where`, then that user is only allowed to do that"
{
    require params.length == 0 && where != where2 && what != what2;

    uint256[] how = helpers.authParams(who, where, what);
    require !isAuthorized(who, where, what, how);

    uint256[] how2 = helpers.authParams(who, where2, what2);
    require !isAuthorized(who, where2, what2, how2);

    authorize(e, who, where, what, params);
    
    assert isAuthorized(who, where, what, how);
    assert !isAuthorized(who, where2, what2, how2);
}

rule unauthorizeWorksProperly(env e, address who, address where, bytes4 what, uint256[] anyhow)
    good_description "If a user has permissions to do `what` on `where` with `params`, if we call unauthorize, then isAuthorized must return false for any `how`"
{
    require !isAuthorized(ANYONE(), where, what, anyhow);
    require !isAuthorized(who, ANYWHERE(), what, anyhow);

    // TODO: "whith params"?
    uint256[] how = helpers.authParams(who, where, what);
    require isAuthorized(who, where, what, how);

    unauthorize(e, who, where, what);

    assert !isAuthorized(who, where, what, anyhow);
}

rule unauthorizedUserCannotDoAnything(address who, address where, bytes4 what, uint256[] anyhow)
    good_description "If a user does not have permissions to do `what` on `where`, then isAuthorized must return false for any `how`"
{
    require !isAuthorized(ANYONE(), where, what, anyhow);
    require !isAuthorized(who, ANYWHERE(), what, anyhow);
    require !hasPermission(who, where, what);

    assert !isAuthorized(who, where, what, anyhow);
}
