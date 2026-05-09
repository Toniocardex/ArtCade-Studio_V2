add_library(artcade-entity-system
    src/entity-manager.cpp
)
target_include_directories(artcade-entity-system
    PUBLIC  include
    PRIVATE src
)
target_link_libraries(artcade-entity-system
    PUBLIC artcade-core
)
