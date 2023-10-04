import "./General.spec";

using Helpers as helpers;

/************************************************************/
/*****                    METHODS                       *****/
/************************************************************/

methods {
    // Helpers
    function helpers.authParams(address,address,bytes4) external returns (uint256[]) envfree;

    // Authorizer
    function ANYONE() external returns (address) envfree => ALWAYS(0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF);
    function ANYWHERE() external returns (address) envfree => ALWAYS(0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF);
    function hasPermissions(address,address) external returns (bool) envfree;
    function hasPermission(address,address,bytes4) external returns (bool) envfree;
    function isAuthorized(address,address,bytes4,uint256[]) external returns (bool) envfree;
    function getPermissionParams(address,address,bytes4) external returns (IAuthorizer.Param[]) envfree;
    function getPermissionsLength(address,address) external returns (uint256) envfree;
}


/************************************************************/
/*****                  DEFINITIONS                     *****/
/************************************************************/

definition INITIALIZE() returns uint32 = sig:initialize(address[]).selector;
definition AUTHORIZE() returns uint32 = sig:authorize(address, address, bytes4, IAuthorizer.Param[]).selector;
definition UNAUTHORIZE() returns uint32 = sig:unauthorize(address, address, bytes4).selector;
definition CHANGE_PERMISSIONS() returns uint32 = sig:changePermissions(IAuthorizer.PermissionChange[]).selector;


/************************************************************/
/*****                   FUNCTIONS                      *****/
/************************************************************/

function buildPermissionChange(
    address where,
    bool withGrant,
    address grantWho,
    bytes4 grantWhat,
    bool withRevoke,
    address revokeWho,
    bytes4 revokeWhat
)
    returns IAuthorizer.PermissionChange
{
    IAuthorizer.PermissionChange change;
    require change.where == where;

    if (withGrant) {
        require change.grants.length == 1;
        IAuthorizer.GrantPermission grant = change.grants[0];
        require grant.who == grantWho && grant.what == grantWhat && grant.params.length == 0;
    } else {
        require change.grants.length == 0;
    }

    if (withRevoke) {
        require change.revokes.length == 1;
        IAuthorizer.RevokePermission revoke = change.revokes[0];
        require revoke.who == revokeWho && revoke.what == revokeWhat;
    } else {
        require change.revokes.length == 0;
    }

    return change;
}

function getPermissionParamsLength(address who, address where, bytes4 what) returns uint256 {
    IAuthorizer.Param[] permissionParams = getPermissionParams(who, where, what);
    return permissionParams.length;
}

function requireNonGenericPermissions(address who, address where, bytes4 what) {
    require !hasPermission(ANYONE(), where, what);
    require !hasPermission(who, ANYWHERE(), what);
    require !hasPermission(ANYONE(), ANYWHERE(), what);
}

function cleanStorage(env e, address who, address where, bytes4 what) {
    require getPermissionParamsLength(who, where, what) == 1;
    unauthorize(e, who, where, what);
}


/************************************************************/
/*****               GHOSTS AND HOOKS                   *****/
/************************************************************/

// PARAMS LENGTH

ghost mapping(address => mapping(address => mapping(bytes4 => uint256))) ghostParamsLength {
    init_state axiom forall address who . forall address where . forall bytes4 what . ghostParamsLength[who][where][what] == 0;
}

hook Sload uint256 length currentContract._permissionsLists[KEY address who][KEY address where].(offset 32)[KEY bytes4 what].(offset 32) STORAGE {
    require ghostParamsLength[who][where][what] == length;
}

hook Sstore currentContract._permissionsLists[KEY address who][KEY address where].(offset 32)[KEY bytes4 what].(offset 32) uint256 newLength STORAGE {
    ghostParamsLength[who][where][what] = newLength;
}

// This invariant was written only for development purposes
//
// invariant checkLength(address who, address where, bytes4 what)
//    ghostParamsLength[who][where][what] == getPermissionParamsLength(who, where, what);

// AUTHORIZED

ghost mapping(address => mapping(address => mapping(bytes4 => bool))) ghostAuthorized {
    init_state axiom forall address who . forall address where . forall bytes4 what . ghostAuthorized[who][where][what] == false;
}

hook Sload bool authorized currentContract._permissionsLists[KEY address who][KEY address where].permissions[KEY bytes4 what].authorized STORAGE {
    require ghostAuthorized[who][where][what] == authorized;
}

hook Sstore currentContract._permissionsLists[KEY address who][KEY address where].permissions[KEY bytes4 what].authorized bool newAuthorized STORAGE {
    ghostAuthorized[who][where][what] = newAuthorized;
}

// This invariant was written only for development purposes
//
// invariant checkAuthorized(address who, address where, bytes4 what)
//    ghostAuthorized[who][where][what] == hasPermission(who, where, what);

// COUNT

ghost mapping(address => mapping(address => uint256)) ghostCount {
    init_state axiom forall address who . forall address where . ghostCount[who][where] == 0;
}

hook Sload uint256 count currentContract._permissionsLists[KEY address who][KEY address where].count STORAGE {
    require ghostCount[who][where] == count;
}

hook Sstore currentContract._permissionsLists[KEY address who][KEY address where].count uint256 newCount STORAGE {
    ghostCount[who][where] = newCount;
}

// This invariant was written only for development purposes
//
// invariant checkCount(address who, address where)
//     ghostCount[who][where] == getPermissionsLength(who, where);


/************************************************************/
/*****                  INVARIANTS                      *****/
/************************************************************/

// ⚠️ NOTE: These invariants are commented for now since the Prover is failing due to a time out.
// In the meantime, the Certora team is analyzing the issue to see how it can be optimized.
//
// invariant validPermissionsState(address who, address where)
//     forall bytes4 what . (ghostCount[who][where] == 0 => !ghostAuthorized[who][where][what])
//         && (ghostAuthorized[who][where][what] => ghostCount[who][where] > 0);
//
// invariant validParamsLength(address who, address where, bytes4 what)
//     !ghostAuthorized[who][where][what] => ghostParamsLength[who][where][what] == 0;


/************************************************************/
/*****                   RULES                      *****/
/************************************************************/

use rule sanity;

use rule reentrancyGuard filtered {
    f -> 
        !f.isView
        && f.selector != CHANGE_PERMISSIONS()
        && f.selector != INITIALIZE()
}

rule senderMustBeAuthorizedToAuthorizeOthers(env e, address who, address where, bytes4 what, IAuthorizer.Param[] params)
    good_description "Only authorized users can authorize other users"
{
    bytes4 authorizeSig = to_bytes4(AUTHORIZE());
    uint256[] how = helpers.authParams(who, where, what);
    bool senderCanAuthorize = isAuthorized(e.msg.sender, currentContract, authorizeSig, how);

    authorize(e, who, where, what, params);

    assert senderCanAuthorize;
}

rule senderMustBeAuthorizedToUnauthorizeOthers(env e, address who, address where, bytes4 what)
    good_description "Only authorized users can unauthorize other users"
{
    bytes4 unauthorizeSig = to_bytes4(UNAUTHORIZE());
    uint256[] how = helpers.authParams(who, where, what);
    bool senderCanUnauthorize = isAuthorized(e.msg.sender, currentContract, unauthorizeSig, how);

    unauthorize(e, who, where, what);

    assert senderCanUnauthorize;
}

rule otherFunctionsCannotAuthorize(env e, method f, calldataarg args, address who, address where, bytes4 what)
    filtered {
        f -> 
            !f.isView
            && f.selector != AUTHORIZE()
            && f.selector != CHANGE_PERMISSIONS()
            && f.selector != INITIALIZE()
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
    require params.length == 0;
    require !hasPermission(who, where, what);
    require getPermissionParamsLength(who, where, what) == 0; // TODO: delete this line once the invariant works

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

    require !hasPermission(who, where, what);
    require !hasPermission(who, where2, what2);

    authorize(e, who, where, what, params);
    
    assert hasPermission(who, where, what);
    assert !hasPermission(who, where2, what2);
}

rule someoneCanPerformTheOperation(env e, address who, address where, bytes4 what, uint256[] how, IAuthorizer.Param[] params)
    good_description "If we call authorize then someone can perform the operation"
{
    require how.length == 3 && params.length <= 3;
    require !hasPermission(who, where, what);

    authorize(e, who, where, what, params);

    satisfy isAuthorized(who, where, what, how);
}

rule unauthorizeWorksProperly(env e, address who, address where, bytes4 what)
    good_description "If a user has permissions to do `what` on `where` and we call `unauthorize`, then the user must be unauthorized"
{
    require hasPermission(who, where, what);

    unauthorize(e, who, where, what);

    assert !hasPermission(who, where, what);
}

rule unauthorizedUserCannotDoAnything(address who, address where, bytes4 what, uint256[] how)
    good_description "If a user does not have permissions to do `what` on `where`, then isAuthorized must return false for any `how`"
{
    requireNonGenericPermissions(who, where, what);
    require !hasPermission(who, where, what);

    assert !isAuthorized(who, where, what, how);
}

// ⚠️ NOTE: We are commenting this rule out since we are receiving false negative results from the prover.
// The buildPermissionChange function requires the params list is empty but for some reason the prover is showing
// examples invalidating the rule that do have non-empty params. The Certora team is currently working on it.
//
// rule grantingPermissionsIsLikeAuthorizing(env e, address who, address where, bytes4 what, IAuthorizer.Param[] params)
//     good_description "Calling changePermissions with 1 grant should be equivalent to calling authorize"
// {
//     require params.length == 0;
//     require !hasPermission(who, where, what);
//     require getPermissionParamsLength(who, where, what) == 0; // TODO: delete this line once the invariant works
//
//     storage initStorage = lastStorage;
//
//     IAuthorizer.PermissionChange change = buildPermissionChange(where, true, who, what, false, 0, to_bytes4(0));
//     changePermissions(e, [change]);
//     storage afterChangePermissions = lastStorage;
//
//     authorize(e, who, where, what, params) at initStorage;
//     storage afterAuthorize = lastStorage;
//
//     assert afterChangePermissions[currentContract] == afterAuthorize[currentContract];
// }

rule revokingPermissionsIsLikeUnauthorizing(env e, address who, address where, bytes4 what)
    good_description "Calling changePermissions with 1 revoke should be equivalent to calling unauthorize"
{
    storage initStorage = lastStorage;

    IAuthorizer.PermissionChange change = buildPermissionChange(where, false, 0, to_bytes4(0), true, who, what);
    changePermissions(e, [change]);
    storage afterChangePermissions = lastStorage;

    unauthorize(e, who, where, what) at initStorage;
    storage afterUnauthorize = lastStorage;

    assert afterChangePermissions[currentContract] == afterUnauthorize[currentContract];
}

rule changePermissionsInBetweenShouldNotChangeStorage
    (env e, address who, address where, bytes4 what, IAuthorizer.Param[] params, address who2, bytes4 what2)
    good_description "Doing authorize, change permissions, and then unauthorize shouldn't change the storage"
{
    require params.length == 0 && who != who2 && what != what2;

    // ⚠️ NOTE: Ideally we would require that the permissions params length is zero but this is not being followed by
    // the prover. Therefore, we had to manage to make sure this pre-requisite is fulfilled by creating this
    // cleanStorage function that basically empties the storage related to a permission. The Certora team is currently
    // working on this issue.
    cleanStorage(e, who, where, what);
    cleanStorage(e, who2, where, what2);

    storage initStorage = lastStorage;

    authorize(e, who, where, what, params);

    IAuthorizer.PermissionChange change = buildPermissionChange(where, true, who2, what2, true, who, what);
    changePermissions(e, [change]);

    unauthorize(e, who2, where, what2);

    storage currentStorage = lastStorage;
    assert initStorage[currentContract] == currentStorage[currentContract];
}

rule changePermissionsOrderMatters(env e, address who, address where, bytes4 what)
    good_description "Calling changePermissions with a grant and its corresponding revoke should leave the user unauthorized"
{
    // ⚠️ NOTE: Ideally we would require that the permissions params length is zero but this is not being followed by
    // the prover. Therefore, we had to manage to make sure this pre-requisite is fulfilled by creating this
    // cleanStorage function that basically empties the storage related to a permission. The Certora team is currently
    // working on this issue.
    cleanStorage(e, who, where, what);

    storage initStorage = lastStorage;

    IAuthorizer.PermissionChange change = buildPermissionChange(where, true, who, what, true, who, what);
    changePermissions(e, [change]);

    storage currentStorage = lastStorage;

    assert !hasPermission(who, where, what);
    assert initStorage[currentContract] == currentStorage[currentContract];
}

rule hasPermissionIsEquivalentToIsAuthorizedWithEmptyParams(address who, address where, bytes4 what, uint256[] how)
    good_description "For a permission without params, hasPermission should be equivalent to isAuthorized"
{
    require getPermissionParamsLength(who, where, what) == 0;
    requireNonGenericPermissions(who, where, what);

    assert isAuthorized(who, where, what, how) == hasPermission(who, where, what);
}

rule anyoneIsAuthorized(env e, address who, address where, bytes4 what, IAuthorizer.Param[] params, address somewhere, bytes4 somewhat)
    good_description "Anyone is authorized to do `what` on `where`"
{
    require params.length == 0;
    require who != ANYONE() && where != ANYWHERE() && where != somewhere && what != somewhat;

    require !hasPermission(who, where, what);
    require !hasPermission(who, somewhere, what);
    require !hasPermission(who, where, somewhat);
    requireNonGenericPermissions(who, where, what);
    requireNonGenericPermissions(who, somewhere, what);
    requireNonGenericPermissions(who, where, somewhat);

    authorize(e, ANYONE(), where, what, params);

    uint256[] how = [];
    assert isAuthorized(who, where, what, how) && !hasPermission(who, where, what);
    assert !isAuthorized(who, somewhere, what, how);
    assert !isAuthorized(who, where, somewhat, how);
}

rule isAuthorizedAnywhere(env e, address who, address where, bytes4 what, IAuthorizer.Param[] params, address someone, bytes4 somewhat)
    good_description "A user is authorized to do `what` anywhere"
{
    require params.length == 0;
    require who != ANYONE() && who != someone && where != ANYWHERE() && what != somewhat;

    require !hasPermission(who, where, what);
    require !hasPermission(someone, where, what);
    require !hasPermission(who, where, somewhat);
    requireNonGenericPermissions(who, where, what);
    requireNonGenericPermissions(someone, where, what);
    requireNonGenericPermissions(who, where, somewhat);

    authorize(e, who, ANYWHERE(), what, params);

    uint256[] how = [];
    assert isAuthorized(who, where, what, how) && !hasPermission(who, where, what);
    assert !isAuthorized(someone, where, what, how);
    assert !isAuthorized(who, where, somewhat, how);
}
