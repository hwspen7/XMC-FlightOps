cmake_minimum_required(VERSION 3.20)
project(XPlaneMotionController LANGUAGES CXX)
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_library(xmc_core STATIC src/protocol.cpp src/config.cpp src/network.cpp src/native_metrics.cpp src/latest_control.cpp src/flight_analysis.cpp)
target_include_directories(xmc_core PUBLIC "${CMAKE_CURRENT_SOURCE_DIR}/include")
if(WIN32)
  target_link_libraries(xmc_core PUBLIC ws2_32)
endif()

include(CTest)
if(BUILD_TESTING)
  add_executable(xmc_protocol_tests tests/protocol.test.cpp)
  target_link_libraries(xmc_protocol_tests PRIVATE xmc_core)
  add_test(NAME protocol COMMAND xmc_protocol_tests)
  add_executable(xmc_control_tests tests/control.test.cpp src/control.cpp)
  target_include_directories(xmc_control_tests PRIVATE "${CMAKE_CURRENT_SOURCE_DIR}/include" "${CMAKE_CURRENT_SOURCE_DIR}/tests/sdk-stubs")
  add_test(NAME control COMMAND xmc_control_tests)
  add_executable(xmc_native_metrics_tests tests/native_metrics.test.cpp)
  target_link_libraries(xmc_native_metrics_tests PRIVATE xmc_core)
  add_test(NAME native_metrics COMMAND xmc_native_metrics_tests)
  add_executable(xmc_latest_control_tests tests/latest_control.test.cpp)
  target_link_libraries(xmc_latest_control_tests PRIVATE xmc_core)
  add_test(NAME latest_control COMMAND xmc_latest_control_tests)
  add_executable(xmc_flight_analysis_tests tests/flight_analysis.test.cpp)
  target_link_libraries(xmc_flight_analysis_tests PRIVATE xmc_core)
  add_test(NAME flight_analysis COMMAND xmc_flight_analysis_tests)
  add_executable(xmc_telemetry_tests tests/telemetry.test.cpp src/telemetry.cpp)
  target_include_directories(xmc_telemetry_tests PRIVATE "${CMAKE_CURRENT_SOURCE_DIR}/include" "${CMAKE_CURRENT_SOURCE_DIR}/tests/sdk-stubs")
  add_test(NAME telemetry COMMAND xmc_telemetry_tests)
  add_executable(xmc_pause_guard_tests tests/pause_guard.test.cpp src/pause_guard.cpp)
  target_include_directories(xmc_pause_guard_tests PRIVATE "${CMAKE_CURRENT_SOURCE_DIR}/include" "${CMAKE_CURRENT_SOURCE_DIR}/tests/sdk-stubs")
  add_test(NAME pause_guard COMMAND xmc_pause_guard_tests)
endif()

# The SDK is user-supplied; never vendor official SDK libraries in this repository.
if(XPLANE_SDK_DIR)
  set(SDK_HEADERS "${XPLANE_SDK_DIR}/CHeaders")
  if(EXISTS "${XPLANE_SDK_DIR}/SDK/CHeaders")
    set(SDK_HEADERS "${XPLANE_SDK_DIR}/SDK/CHeaders")
    set(XPLANE_SDK_DIR "${XPLANE_SDK_DIR}/SDK")
  endif()
  if(NOT EXISTS "${SDK_HEADERS}/XPLM/XPLMPlugin.h")
    message(FATAL_ERROR "XPLANE_SDK_DIR must point to the extracted official SDK or its SDK subdirectory")
  endif()
  add_library(xmc_plugin MODULE src/plugin.cpp src/control.cpp src/telemetry.cpp src/pause_guard.cpp)
  target_link_libraries(xmc_plugin PRIVATE xmc_core)
  target_include_directories(xmc_plugin PRIVATE "${SDK_HEADERS}/XPLM" "${SDK_HEADERS}/Widgets")
  target_compile_definitions(xmc_plugin PRIVATE XPLM200 XPLM210 XPLM300 XPLM301 XPLM303 XPLM400)
  set_target_properties(xmc_plugin PROPERTIES PREFIX "")
  if(APPLE)
    set_target_properties(xmc_plugin PROPERTIES SUFFIX ".xpl" OUTPUT_NAME "mac")
    target_link_libraries(xmc_plugin PRIVATE "${XPLANE_SDK_DIR}/Libraries/Mac/XPLM.framework")
  elseif(WIN32)
    target_compile_definitions(xmc_plugin PRIVATE
      IBM=1
      APL=0
      LIN=0
      WIN32_LEAN_AND_MEAN
      NOMINMAX
    )

    set_target_properties(xmc_plugin PROPERTIES
      SUFFIX ".xpl"
      OUTPUT_NAME "win"
    )

    target_link_libraries(xmc_plugin PRIVATE
      "${XPLANE_SDK_DIR}/Libraries/Win/XPLM_64.lib"
    )
  else()
    set_target_properties(xmc_plugin PROPERTIES SUFFIX ".xpl" OUTPUT_NAME "lin")
    # X-Plane resolves SDK symbols when the plugin is loaded on Linux.
  endif()
endif()
