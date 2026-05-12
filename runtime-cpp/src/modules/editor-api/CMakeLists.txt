add_library(artcade-editor-api STATIC
    src/editor-api.cpp
)

target_include_directories(artcade-editor-api PUBLIC include)
target_link_libraries(artcade-editor-api PUBLIC artcade-core)

if(TARGET artcade-runtime-entity-gateway)
    target_link_libraries(artcade-editor-api PUBLIC artcade-runtime-entity-gateway)
endif()

if(EMSCRIPTEN)
    message(STATUS "[ArtCade] editor-api  : WASM — full bridge (EMSCRIPTEN_KEEPALIVE + EM_ASM)")
else()
    message(STATUS "[ArtCade] editor-api  : Native — no-op stubs only")
endif()
