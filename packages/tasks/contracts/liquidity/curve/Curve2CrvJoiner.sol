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

import '@mimic-fi/v3-helpers/contracts/utils/BytesHelpers.sol';
import '@mimic-fi/v3-connectors/contracts/liquidity/curve/Curve2CrvConnector.sol';

import './BaseCurveTask.sol';
import '../../interfaces/liquidity/curve/ICurve2CrvJoiner.sol';

/**
 * @title Curve 2CRV joiner task
 */
contract Curve2CrvJoiner is ICurve2CrvJoiner, BaseCurveTask {
    using BytesHelpers for bytes;

    // Execution type for relayers
    bytes32 public constant override EXECUTION_TYPE = keccak256('CURVE_2CRV_JOINER');

    /**
     * @dev Curve 2CRV joiner task config. Only used in the initializer.
     */
    struct Curve2CrvJoinerConfig {
        BaseCurveConfig baseCurveConfig;
    }

    /**
     * @dev Initializes a Curve 2CRV joiner task
     */
    function initialize(Curve2CrvJoinerConfig memory config) external initializer {
        _initialize(config.baseCurveConfig);
    }

    /**
     * @dev Executes the Curve 2CRV joiner task
     * @param token Address of the token to join the Curve pool with
     * @param amount Amount of tokens to join the Curve pool with
     */
    function call(address token, uint256 amount, uint256 slippage)
        external
        override
        authP(authParams(token, amount, slippage))
        baseCurveTaskCall(token, amount, slippage)
    {
        address tokenOut = _getApplicableTokenOut(token);
        bytes memory connectorData = abi.encodeWithSelector(
            Curve2CrvConnector.join.selector,
            tokenOut,
            token,
            amount,
            slippage
        );

        bytes memory result = ISmartVault(smartVault).execute(connector, connectorData);
        _increaseBalanceConnector(tokenOut, result.toUint256());
    }
}
