import "./General.spec";

methods {
    function isPaused() external returns (bool) envfree;
    function priceOracle() external returns (address) envfree;
    function isConnectorCheckIgnored(address) external returns (bool) envfree;
    function getBalanceConnector(bytes32, address) external returns (uint256) envfree;
    function pause() external envfree;
    function unpause() external envfree;
    function setPriceOracle(address) external envfree;
    function overrideConnectorCheck(address, bool) external envfree;
    function updateBalanceConnector(bytes32, address, uint256, bool) external envfree;
}

definition INITIALIZE() returns uint8 = 0;
definition PAUSE() returns uint8 = 1;
definition UNPAUSE() returns uint8 = 2;

definition getSelector(uint8 f) returns uint32 = (
    f == INITIALIZE() ?
        sig:initialize(address, address).selector : (
    f == PAUSE() ? 
        sig:pause().selector : (
    f == UNPAUSE() ?
        sig:unpause().selector : 0
    ))
);

use rule sanity;

use rule reentrancyGuard filtered {
    f -> 
        !f.isView
        && !f.isFallback
        && f.selector != getSelector(INITIALIZE())
        && f.selector != getSelector(PAUSE())
        && f.selector != getSelector(UNPAUSE())
}

rule canOnlyCallUnpause(env e, method f, calldataarg args)
    filtered { 
        f ->
            !f.isView
            && !f.isFallback
            && f.selector != getSelector(INITIALIZE())
    }
    good_description "If the smart vault is paused, then we cannot call any non-view function except for unpause"
{
    require isPaused();

    f@withrevert(e, args);

    assert lastReverted || f.selector == getSelector(UNPAUSE());
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

rule setPriceOracleProperly(address newPriceOracle)
    good_description "Calling `setPriceOracle` should set the price oracle properly"
{
    setPriceOracle(newPriceOracle);
    assert priceOracle() == newPriceOracle;
}

rule overrideConnectorCheckProperly(address connector, bool ignored)
    good_description "Calling `overrideConnectorCheck` should override the connector check properly"
{
    overrideConnectorCheck(connector, ignored);
    assert isConnectorCheckIgnored(connector) == ignored;
}

rule updateBalanceConnectorProperly(bytes32 id, address token, uint256 amount, bool add)
    good_description "Calling `updateBalanceConnector` should update the balance connector properly"
{
    uint256 initBalanceConnector = getBalanceConnector(id, token);

    updateBalanceConnector(id, token, amount, add);

    uint256 currentBalanceConnector = getBalanceConnector(id, token);
    assert to_mathint(currentBalanceConnector) == initBalanceConnector + (add ? amount : -amount);
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
