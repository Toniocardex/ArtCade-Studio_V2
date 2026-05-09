#pragma once

#include <string>

namespace ArtCade {

/**
 * Logger: Simple logging utility
 *
 * Thread-safe logging with levels: Info, Warning, Error, Debug
 */
class Logger {
public:
    static void init();
    static void shutdown();

    static void log(const std::string& message);
    static void warning(const std::string& message);
    static void error(const std::string& message);
    static void debug(const std::string& message);

    static void setLogLevel(int level); // 0=Debug, 1=Info, 2=Warning, 3=Error

private:
    static int logLevel_;
};

} // namespace ArtCade
