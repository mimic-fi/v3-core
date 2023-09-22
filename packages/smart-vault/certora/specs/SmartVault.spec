import "./General.spec";

using Helpers as helpers;
using WrappedNativeTokenMock as WrappedNativeTokenMock;
using Authorizer as Authorizer;

// METHODS
methods {
    // Helpers
    function helpers.nativeBalanceOf(address) external returns (uint256) envfree;

    // Wrapped native token mock
    function WrappedNativeTokenMock.deposit() external;
    function WrappedNativeTokenMock.withdraw(uint256) external;
    function WrappedNativeTokenMock.balanceOf(address) external returns (uint256) envfree;

    // Authorizer
    function Authorizer.isAuthorized(address,address,bytes4,uint256[]) external returns (bool) envfree;

    // Smart vault
    function isPaused() external returns (bool) envfree;
    function priceOracle() external returns (address) envfree;
    function wrappedNativeToken() external returns (address) envfree;
    function isConnectorCheckIgnored(address) external returns (bool) envfree;
    function getBalanceConnector(bytes32,address) external returns (uint256) envfree;
    function pause() external envfree;
    function unpause() external envfree;
    function setPriceOracle(address) external envfree;
    function overrideConnectorCheck(address,bool) external envfree;
    function updateBalanceConnector(bytes32,address,uint256,bool) external envfree;
}

// DEFINITIONS
definition INITIALIZE() returns uint32 = sig:initialize(address, address).selector;
definition PAUSE() returns uint32 = sig:pause().selector;
definition UNPAUSE() returns uint32 = sig:unpause().selector;
definition EXECUTE() returns uint32 = sig:execute(address, bytes).selector;
definition SET_PRICE_ORACLE() returns uint32 = sig:setPriceOracle(address).selector;
definition OVERRIDE_CONNECTOR_CHECK() returns uint32 = sig:overrideConnectorCheck(address, bool).selector;
definition UPDATE_BALANCE_CONNECTOR() returns uint32 = sig:updateBalanceConnector(bytes32, address, uint256, bool).selector;
definition WRAP() returns uint32 = sig:wrap(uint256).selector;
definition UNWRAP() returns uint32 = sig:unwrap(uint256).selector;

// RULES
use rule sanity;

use rule reentrancyGuard filtered {
    f -> 
        !f.isView
        && !f.isFallback
        && f.selector != INITIALIZE()
        && f.selector != PAUSE()
        && f.selector != UNPAUSE()
}

rule canOnlyCallUnpause(env e, method f, calldataarg args)
    filtered { 
        f ->
            !f.isView
            && !f.isFallback
            && f.selector != INITIALIZE()
    }
    good_description "If the smart vault is paused, then we cannot call any non-view function except for unpause"
{
    require isPaused();

    f@withrevert(e, args);

    assert lastReverted || f.selector == UNPAUSE();
}

rule stillUnpaused() good_description "Calling pause and then unpause should leave the smart vault unpaused" {
    require !isPaused();
    pause();
    unpause();
    assert !isPaused();
}

rule stillPaused() good_description "Calling unpause and then pause should leave the smart vault paused" {
    require isPaused();
    unpause();
    pause();
    assert isPaused();
}

rule setPriceOracleOnly(env e, method f, calldataarg args)
    filtered {
        f -> 
            !f.isView
            && f.selector != INITIALIZE()
            && f.selector != EXECUTE()
            && f.selector != SET_PRICE_ORACLE()
    }
    good_description "The only method that can modify `priceOracle` reference is `setPriceOracle`"
{
    address initPriceOracle = priceOracle();

    f(e, args);
    
    assert priceOracle() == initPriceOracle;
}

rule overrideConnectorCheckOnly(env e, method f, calldataarg args, address connector)
    filtered {
        f -> 
            !f.isView
            && f.selector != EXECUTE()
            && f.selector != OVERRIDE_CONNECTOR_CHECK()
    }
    good_description "The only method that can modify `isConnectorCheckIgnored` values is `overrideConnectorCheck`"
{
    bool initIgnored = isConnectorCheckIgnored(connector);

    f(e, args);

    assert isConnectorCheckIgnored(connector) == initIgnored;
}

rule updateBalanceConnectorOnly(env e, method f, calldataarg args, bytes32 id, address token)
    filtered {
        f -> 
            !f.isView
            && f.selector != EXECUTE()
            && f.selector != UPDATE_BALANCE_CONNECTOR()
    }
    good_description "The only method that can modify balances connectors is `updateBalanceConnector`"
{
    uint256 initBalanceConnector = getBalanceConnector(id, token);

    f(e, args);

   assert getBalanceConnector(id, token) == initBalanceConnector;
}

rule increaseAndDecreaseShouldNotChangeBalanceConnector(bytes32 id, address token, uint256 amount)
    good_description "Calling `updateBalanceConnector` twice with opposite `amount` values should not change the connector balance"
{
    uint256 initBalanceConnector = getBalanceConnector(id, token);

    updateBalanceConnector(id, token, amount, true);
    updateBalanceConnector(id, token, amount, false);

    uint256 currentBalanceConnector = getBalanceConnector(id, token);
    assert initBalanceConnector == currentBalanceConnector;
}

rule wrapUnwrapIntegrity(env e, uint256 amount)
    good_description "Calling `wrap` and then `unwrap` should not change the smart vault balance"
{
    storage initStorage = lastStorage;

    wrap(e, amount);
    unwrap(e, amount);

    storage currentStorage = lastStorage;
    assert initStorage[nativeBalances] == currentStorage[nativeBalances];
}

rule unwrapWrapIntegrity(env e, uint256 amount)
    good_description "Calling `unwrap` and then `wrap` should not change the smart vault balance"
{
    storage initStorage = lastStorage;

    unwrap(e, amount);
    wrap(e, amount);

    storage currentStorage = lastStorage;
    assert initStorage[nativeBalances] == currentStorage[nativeBalances];
}

rule wrapProperBalances(env e, uint256 amount)
    good_description "After wrapping an `amount` of native tokens, the smart vault balance in wrapped and native token should respectively increase and decrease by that `amount`"
{
    uint256 initNativeBalance = helpers.nativeBalanceOf(currentContract);
    uint256 initWrappedBalance = WrappedNativeTokenMock.balanceOf(currentContract);

    wrap(e, amount);

    uint256 currentNativeBalance = helpers.nativeBalanceOf(currentContract);
    uint256 currentWrappedBalance = WrappedNativeTokenMock.balanceOf(currentContract);
    
    assert to_mathint(currentNativeBalance) == initNativeBalance - amount;
    assert to_mathint(currentWrappedBalance) == initWrappedBalance + amount;
}

rule unwrapProperBalances(env e, uint256 amount)
    good_description "After unwrapping an `amount` of wrapped native tokens, the smart vault balance in wrapped and native token should respectively decrease and increase by that `amount`"
{
    uint256 initNativeBalance = helpers.nativeBalanceOf(currentContract);
    uint256 initWrappedBalance = WrappedNativeTokenMock.balanceOf(currentContract);

    unwrap(e, amount);

    uint256 currentNativeBalance = helpers.nativeBalanceOf(currentContract);
    uint256 currentWrappedBalance = WrappedNativeTokenMock.balanceOf(currentContract);
    
    assert to_mathint(currentNativeBalance) == initNativeBalance + amount;
    assert to_mathint(currentWrappedBalance) == initWrappedBalance - amount;
}

rule unwrapCannotRevertAfterWrap(env e, uint256 amount, uint256 amountToUnwrap) {
    require amountToUnwrap > 0;

    uint256[] how = [amountToUnwrap];
    require Authorizer.isAuthorized(e.msg.sender, currentContract, to_bytes4(UNWRAP()), how);

    uint256 wrappedBalanceBefore = WrappedNativeTokenMock.balanceOf(currentContract);

    wrap(e, amount);

    uint256 wrappedBalanceAfter = WrappedNativeTokenMock.balanceOf(currentContract);
    mathint wrappedAmount = wrappedBalanceAfter - wrappedBalanceBefore;

    unwrap@withrevert(e, amountToUnwrap);
    
    assert to_mathint(amountToUnwrap) <= wrappedAmount => !lastReverted;
}

rule wrapCannotRevertAfterUnwrap(env e, uint256 amount, uint256 amountToWrap) {
    require amountToWrap > 0;

    uint256[] how = [amountToWrap];
    require Authorizer.isAuthorized(e.msg.sender, currentContract, to_bytes4(WRAP()), how);

    uint256 wrappedBalanceBefore = WrappedNativeTokenMock.balanceOf(currentContract);

    unwrap(e, amount);

    uint256 wrappedBalanceAfter = WrappedNativeTokenMock.balanceOf(currentContract);
    mathint unwrappedAmount = wrappedBalanceBefore - wrappedBalanceAfter;

    wrap@withrevert(e, amountToWrap);
    
    assert to_mathint(amountToWrap) <= unwrappedAmount => !lastReverted;
}
