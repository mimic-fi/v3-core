// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

pragma solidity ^0.8.0;

import '@mimic-fi/v3-connectors/contracts/bridge/hop/HopConnector.sol';
import '@mimic-fi/v3-helpers/contracts/math/FixedPoint.sol';

import './BaseBridgeTask.sol';
import '../interfaces/bridge/IHopBridger.sol';

/**
 * @title Hop bridger
 * @dev Task that extends the base bridge task to use Hop
 */
contract HopBridger is IHopBridger, BaseBridgeTask {
    using FixedPoint for uint256;

    // Execution type for relayers
    bytes32 public constant override EXECUTION_TYPE = keccak256('HOP_BRIDGER');

    // Relayer address
    address public override relayer;

    // Maximum deadline in seconds
    uint256 public override maxDeadline;

    // Default max fee pct
    uint256 public override defaultMaxFeePct;

    // Max fee percentage per token
    mapping (address => uint256) public override customMaxFeePct;

    // List of Hop entrypoints per token
    mapping (address => address) public override tokenHopEntrypoint;

    /**
     * @dev Custom max fee percentage config. Only used in the initializer.
     */
    struct CustomMaxFeePct {
        address token;
        uint256 maxFeePct;
    }

    /**
     * @dev Token Hop entrypoint config. Only used in the initializer.
     */
    struct TokenHopEntrypoint {
        address token;
        address entrypoint;
    }

    /**
     * @dev Hop bridge config. Only used in the initializer.
     */
    struct HopBridgeConfig {
        address relayer;
        uint256 maxFeePct;
        uint256 maxDeadline;
        CustomMaxFeePct[] customMaxFeePcts;
        TokenHopEntrypoint[] tokenHopEntrypoints;
        BaseBridgeConfig baseBridgeConfig;
    }

    /**
     * @dev Initializes the Hop bridger
     * @param config Hop bridge config
     */
    function initialize(HopBridgeConfig memory config) external virtual initializer {
        __HopBridger_init(config);
    }

    /**
     * @dev Initializes the Hop bridger. It does call upper contracts initializers.
     * @param config Hop bridge config
     */
    function __HopBridger_init(HopBridgeConfig memory config) internal onlyInitializing {
        __BaseBridgeTask_init(config.baseBridgeConfig);
        __HopBridger_init_unchained(config);
    }

    /**
     * @dev Initializes the Hop bridger. It does not call upper contracts initializers.
     * @param config Hop bridge config
     */
    function __HopBridger_init_unchained(HopBridgeConfig memory config) internal onlyInitializing {
        _setRelayer(config.relayer);
        _setMaxDeadline(config.maxDeadline);
        _setDefaultMaxFeePct(config.maxFeePct);

        for (uint256 i = 0; i < config.customMaxFeePcts.length; i++) {
            CustomMaxFeePct memory customConfig = config.customMaxFeePcts[i];
            _setCustomMaxFeePct(customConfig.token, customConfig.maxFeePct);
        }

        for (uint256 i = 0; i < config.tokenHopEntrypoints.length; i++) {
            TokenHopEntrypoint memory customConfig = config.tokenHopEntrypoints[i];
            _setTokenHopEntrypoint(customConfig.token, customConfig.entrypoint);
        }
    }

    /**
     * @dev Tells the max fee percentage that should be used for a token
     */
    function getMaxFeePct(address token) public view virtual override returns (uint256) {
        uint256 maxFeePct = customMaxFeePct[token];
        return maxFeePct == 0 ? defaultMaxFeePct : maxFeePct;
    }

    /**
     * @dev Sets the relayer, only used when bridging from L1 to L2
     * @param newRelayer New relayer address to be set
     */
    function setRelayer(address newRelayer) external override authP(authParams(newRelayer)) {
        _setRelayer(newRelayer);
    }

    /**
     * @dev Sets the max deadline
     * @param newMaxDeadline New max deadline to be set
     */
    function setMaxDeadline(uint256 newMaxDeadline) external override authP(authParams(newMaxDeadline)) {
        _setMaxDeadline(newMaxDeadline);
    }

    /**
     * @dev Sets the default max fee percentage
     * @param maxFeePct New default max fee percentage to be set
     */
    function setDefaultMaxFeePct(uint256 maxFeePct) external override authP(authParams(maxFeePct)) {
        _setDefaultMaxFeePct(maxFeePct);
    }

    /**
     * @dev Sets a custom max fee percentage
     * @param token Token address to set a max fee percentage for
     * @param maxFeePct Max fee percentage to be set for a token
     */
    function setCustomMaxFeePct(address token, uint256 maxFeePct)
        external
        override
        authP(authParams(token, maxFeePct))
    {
        _setCustomMaxFeePct(token, maxFeePct);
    }

    /**
     * @dev Sets an entrypoint for a tokens
     * @param token Token address to set a Hop entrypoint for
     * @param entrypoint Hop entrypoint address to be set for a token
     */
    function setTokenHopEntrypoint(address token, address entrypoint)
        external
        override
        authP(authParams(token, entrypoint))
    {
        _setTokenHopEntrypoint(token, entrypoint);
    }

    /**
     * @dev Execute Hop bridger
     */
    function call(address token, uint256 amount, uint256 slippage, uint256 fee)
        external
        override
        authP(authParams(token, amount, slippage, fee))
    {
        _beforeHopBridger(token, amount, slippage, fee);
        uint256 minAmountOut = amount.mulUp(FixedPoint.ONE - slippage);
        bytes memory connectorData = abi.encodeWithSelector(
            HopConnector.execute.selector,
            getDestinationChain(token),
            token,
            amount,
            minAmountOut,
            recipient,
            tokenHopEntrypoint[token],
            block.timestamp + maxDeadline,
            relayer,
            fee
        );

        ISmartVault(smartVault).execute(connector, connectorData);
        _afterHopBridger(token, amount, slippage, fee);
    }

    /**
     * @dev Before Hop bridger hook
     */
    function _beforeHopBridger(address token, uint256 amount, uint256 slippage, uint256 fee) internal virtual {
        _beforeBaseBridgeTask(token, amount, slippage);
        require(tokenHopEntrypoint[token] != address(0), 'TASK_MISSING_HOP_ENTRYPOINT');
        require(fee.divUp(amount) <= getMaxFeePct(token), 'TASK_FEE_TOO_HIGH');
    }

    /**
     * @dev After Hop bridger hook
     */
    function _afterHopBridger(address token, uint256 amount, uint256 slippage, uint256) internal virtual {
        _afterBaseBridgeTask(token, amount, slippage);
    }

    /**
     * @dev Sets the relayer address, only used when bridging from L1 to L2
     */
    function _setRelayer(address _relayer) internal {
        relayer = _relayer;
        emit RelayerSet(_relayer);
    }

    /**
     * @dev Sets the max deadline
     */
    function _setMaxDeadline(uint256 _maxDeadline) internal {
        require(_maxDeadline > 0, 'TASK_MAX_DEADLINE_ZERO');
        maxDeadline = _maxDeadline;
        emit MaxDeadlineSet(_maxDeadline);
    }

    /**
     * @dev Sets the default max fee percentage
     * @param maxFeePct Default max fee percentage to be set
     */
    function _setDefaultMaxFeePct(uint256 maxFeePct) internal {
        defaultMaxFeePct = maxFeePct;
        emit DefaultMaxFeePctSet(maxFeePct);
    }

    /**
     * @dev Set a Hop entrypoint for a token
     * @param token Address of the token to set a Hop entrypoint for
     * @param entrypoint Hop entrypoint to be set
     */
    function _setTokenHopEntrypoint(address token, address entrypoint) internal {
        require(token != address(0), 'TASK_HOP_TOKEN_ZERO');
        tokenHopEntrypoint[token] = entrypoint;
        emit TokenHopEntrypointSet(token, entrypoint);
    }

    /**
     * @dev Sets a custom max fee percentage for a token
     * @param token Address of the token to set a custom max fee percentage for
     * @param maxFeePct Max fee percentage to be set for the given token
     */
    function _setCustomMaxFeePct(address token, uint256 maxFeePct) internal {
        require(token != address(0), 'TASK_HOP_TOKEN_ZERO');
        customMaxFeePct[token] = maxFeePct;
        emit CustomMaxFeePctSet(token, maxFeePct);
    }
}
